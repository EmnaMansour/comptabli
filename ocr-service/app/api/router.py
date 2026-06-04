from fastapi import APIRouter, File, UploadFile, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session
from typing import Dict, Any, List
import io
import time
import pdfplumber

from app.database.connection import get_db
from app.database.models import FeedbackRecord
from app.inference.extractor import InvoiceExtractor
from app.ocr.fallback import extraire_avec_regex  # fallback
from app.training.train_crf import train_crf_model
from app.ml.alignment import align_annotations_to_tokens
from app.ml.retraining import lancer_retraining, incrementer_compteur_et_verifier
from app.ocr.text_extraction import extraire_lignes_pdf, extraire_lignes_image
from pydantic import BaseModel

# We use the old main.py extraire_avec_regex as a fallback, 
# so we will import it correctly later when main.py is refactored.

router = APIRouter()
extractor = InvoiceExtractor()

class FeedbackRequest(BaseModel):
    texte_brut: str
    annotations: Dict[str, Any]
    metadata_json: Dict[str, Any] = {}

@router.post("/predict")
async def predict_invoice(file: UploadFile = File(...)):
    start_time = time.time()
    
    # 1. Read and OCR
    content = await file.read()
    texte_brut = ""
    
    filename = file.filename or ""
    ext = filename.lower().split('.')[-1] if '.' in filename else ""
    content_type = file.content_type or ""
    
    is_pdf = ext == "pdf" or "pdf" in content_type
    is_image = ext in ["jpg", "jpeg", "png", "tiff", "bmp", "webp"] or "image" in content_type
    
    try:
        if is_pdf:
            texte_brut = "\n".join(extraire_lignes_pdf(content))
        elif is_image or not is_pdf:  # Default to image extraction if unknown
            texte_brut = "\n".join(extraire_lignes_image(content))
    except Exception as e:
        error_msg = str(e).lower()
        if "tesseract" in error_msg or "tesseractnotfounderror" in str(type(e)).lower():
            raise HTTPException(status_code=500, detail="Tesseract OCR n'est pas installé sur Windows. L'extraction d'images est impossible. Veuillez utiliser un PDF numérique ou installer Tesseract.")
        if "poppler" in error_msg:
            raise HTTPException(status_code=500, detail="Poppler n'est pas installé. L'extraction de PDF scannés est impossible. Veuillez utiliser un PDF numérique.")
        print(f"Error extracting text: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur extraction texte : {str(e)}")
    
    if not texte_brut.strip():
        raise HTTPException(status_code=400, detail="Aucun texte extrait du document.")
        
    # 2. Extract with CRF
    result = {}
    try:
        if extractor.crf_model is not None:
            result = extractor.extract(texte_brut)
    except Exception as e:
        print(f"CRF extraction error: {e}")
        
    # 3. Fallback to Regex if CRF fails or confidence is too low
    global_conf = result.get("global_confidence_score", 0.0)
    
    # If confidence < 70% or missing critical fields, use regex fallback
    if global_conf < 0.70:
        print(f"[WARN] Confidence too low ({global_conf}). Using Regex Fallback.")
        regex_result = extraire_avec_regex(texte_brut)
        
        # We transform regex output to match the confidence structure
        result = {}
        for k, v in regex_result.items():
            if k in ["identifiants", "methode", "lignes"]:
                result[k] = v
            else:
                result[k] = {"value": v, "confidence": 0.5} if v else None
                
        result["method"] = regex_result.get("methode", "regex_fallback")
        result["global_confidence_score"] = 0.5
        
    result["texte_brut"] = texte_brut
    result["temps_traitement"] = round(time.time() - start_time, 2)
    
    return result

@router.post("/feedback")
async def receive_feedback(
    feedback: FeedbackRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    """
    Saves a user-corrected invoice annotation for continuous learning.
    """
    new_record = FeedbackRecord(
        texte_brut=feedback.texte_brut,
        annotations=feedback.annotations,
        metadata_json=feedback.metadata_json
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    # ── AMÉLIORATION 4 : Vérifier si un réentraînement automatique est nécessaire ──
    doit_reentrainer = incrementer_compteur_et_verifier()
    if doit_reentrainer:
        print("[RETRAINING] Seuil de 50 feedbacks atteint — réentraînement lancé en arrière-plan")
        background_tasks.add_task(_auto_retraining_task, db)

    return {"status": "success", "id": new_record.id, "message": "Feedback saved for training."}

def background_training_task(db: Session):
    records = db.query(FeedbackRecord).all()
    if not records:
        print("[INFO] No feedback records for training.")
        return
        
    print(f"[INFO] Formatting {len(records)} feedback records for CRF training...")
    
    training_data = []
    for rec in records:
        try:
            tags = align_annotations_to_tokens(rec.texte_brut, rec.annotations)
            training_data.append((rec.texte_brut, tags))
        except Exception as e:
            print(f"[ERROR] Alignment failed for record {rec.id}: {e}")
            
    if not training_data:
        print("[WARN] No valid training data after alignment.")
        return
        
    print(f"[INFO] Starting CRF retraining with {len(training_data)} samples...")
    try:
        train_crf_model(training_data)
        # extractor.load_model() # We should ideally notify the extractor to reload
        print("[OK] Model retraining complete.")
    except Exception as e:
        print(f"[ERROR] Training task failed: {e}")

@router.post("/train")
async def trigger_training(background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    """
    Triggers an asynchronous retraining of the CRF model using stored feedback.
    """
    background_tasks.add_task(background_training_task, db)
    return {"status": "success", "message": "Training job started in background."}


# ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
# AMÉLIORATION 4 — Tâche de réentraînement automatique
# ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

def _auto_retraining_task(db: Session):
    """Tâche arrière-plan : récupère tous les feedbacks et lance lancer_retraining()."""
    try:
        records = db.query(FeedbackRecord).all()
        print(f"[RETRAINING] Début avec {len(records)} feedbacks")
        resultat = lancer_retraining(
            feedback_records=records,
            extractor_instance=extractor,  # pour rechargement immédiat si déployé
        )
        print(f"[RETRAINING] Terminé : {resultat}")
    except Exception as e:
        print(f"[RETRAINING] Erreur : {e}")


@router.get("/retraining/log")
async def get_retraining_log():
    """Retourne l'historique des réentraînements depuis retraining_log.json."""
    import os, json
    log_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../ml/retraining_log.json")
    if not os.path.exists(log_path):
        return {"historique": [], "message": "Aucun réentraînement effectué pour l'instant."}
    with open(log_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return {"historique": data, "nb_entrees": len(data)}
