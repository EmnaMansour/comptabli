"""
Microservice OCR — FastAPI
===========================
Endpoint principal : POST /extraire
Reçoit un fichier PDF ou image, retourne les données structurées.

Stack :
  - FastAPI          → API REST
  - pdfplumber       → extraction texte PDF natif
  - Tesseract        → OCR pour PDF scannés et images
  - Modèle CRF       → extraction intelligente des champs
  - correctif_lignes → découpage colonnes PDF

Lancer :
  uvicorn main:app --host 0.0.0.0 --port 8001 --reload
"""

import os
import re
import time
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from pydantic import BaseModel

from app.database.connection import init_db
from app.api.router import router as ml_router
from app.ocr.fallback import PATTERNS, extraire_avec_regex, _nettoyer_montant
from app.ocr.text_extraction import extraire_lignes_pdf, extraire_lignes_image, score_qualite_image
from PIL import Image
import io as _io

# Initialize the feedback database
init_db()

# ── Application FastAPI ───────────────────────────────────────────────────────
app = FastAPI(
    title="Comptabli OCR Service",
    description="Microservice d'extraction intelligente de données de factures",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",   # NestJS backend
        "http://localhost:5173",   # Vite dev
        os.getenv("FRONTEND_URL", "http://localhost:3000"),
    ],
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


app.include_router(ml_router, prefix="/api/v1/ml", tags=["ML OCR Pipeline"])

@app.on_event("startup")
async def startup():
    print("[START] FastAPI OCR Service with CRF Pipeline started!")


# ── Schémas de réponse (Pydantic) ─────────────────────────────────────────────

class LigneFacture(BaseModel):
    description:  str
    quantite:     str = "1"
    prix_unitaire: Optional[str] = None
    montant:      Optional[str] = None


class OcrResultat(BaseModel):
    fournisseur:       Optional[str] = None
    client:            Optional[str] = None
    numero_facture:    Optional[str] = None
    date_emission:     Optional[str] = None
    total_ht:          Optional[str] = None
    tva:               Optional[str] = None
    total_ttc:         Optional[str] = None
    devise:            Optional[str] = None
    lignes:            list[LigneFacture] = []
    identifiants:      list[str]     = []
    confiance:         str           = "0/4"
    methode:           str           = "regex"
    temps_traitement:  float         = 0.0
    texte_brut:        Optional[str] = None


class SanteResponse(BaseModel):
    statut:   str
    modele:   str
    version:  str


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACTION DE TEXTE
# ═══════════════════════════════════════════════════════════════════════════════

# (Fonctions d'extraction déplacées dans app.ocr.text_extraction)


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACTION DES LIGNES D'ARTICLES
# ═══════════════════════════════════════════════════════════════════════════════

# (Lignes extraction moved to app.ocr.fallback)

# ═══════════════════════════════════════════════════════════════════════════════
# ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

@app.get("/sante", response_model=SanteResponse)
async def sante():
    """Vérification que le service tourne."""
    return {
        "statut":  "ok",
        "modele":  "regex-fallback + CRF ready",
        "version": "2.0.0",
    }


@app.post("/extraire", response_model=OcrResultat)
async def extraire(
    file: UploadFile = File(...),
    debug:   bool       = False,
):
    """
    Endpoint principal d'extraction OCR.

    Paramètres :
      file  — PDF ou image (JPG, PNG, TIFF)
      debug    — si true, inclut le texte brut OCR dans la réponse
    """
    debut = time.time()

    # Validation du type de fichier — accepte aussi les fichiers sans extension
    ext = Path(file.filename or "").suffix.lower()
    content_type = file.content_type or ""
    types_autorises = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp", ""}
    
    # Détecter si PDF ou image selon l'extension ET le content_type
    is_pdf = ext == ".pdf" or "pdf" in content_type
    is_image = ext in {".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp"} or "image" in content_type
    
    # Si extension non reconnue mais pas vide, refuser
    if ext and ext not in types_autorises:
        raise HTTPException(
            status_code=422,
            detail=f"Format non supporté : {ext}. Utilisez PDF, JPG ou PNG."
        )

    contenu = await file.read()
    if len(contenu) > 20 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="Fichier trop volumineux (max 20 MB)")
    
    # Détecter le type par les magic bytes si l'extension est absente
    if not ext:
        if contenu[:4] == b'%PDF':
            is_pdf = True
            is_image = False
        elif contenu[:3] in (b'\xff\xd8\xff', b'GIF') or contenu[:4] in (b'\x89PNG', b'RIFF', b'II*\x00', b'MM\x00*'):
            is_image = True
            is_pdf = False
        else:
            # Essayer image par défaut (Tesseract est robuste)
            is_image = True
            is_pdf = False

    # ── Extraction de texte ────────────────────────────────────────────────
    try:
        if is_pdf:
            lignes = extraire_lignes_pdf(contenu)
        else:
            # ── AMÉLIORATION 1 : Contrôle qualité image avant OCR ────────────
            try:
                img_check = Image.open(_io.BytesIO(contenu))
                qualite   = score_qualite_image(img_check)
                if qualite["statut"] != "ok":
                    raise HTTPException(
                        status_code=422,
                        detail={
                            "code":    "IMAGE_QUALITY_ERROR",
                            "statut":  qualite["statut"],
                            "message": qualite["message"],
                            "score":   qualite["score"],
                            "details": qualite["details"],
                        }
                    )
            except HTTPException:
                raise
            except Exception as qe:
                # Si l'analyse qualité échoue, on continue quand même (fail-open)
                print(f"[WARN] Analyse qualité image échouée : {qe}")

            lignes = extraire_lignes_image(contenu)
    except HTTPException:
        # Laisser passer les HTTPException (ex: contrôle qualité image 422)
        raise
    except Exception as e:
        import traceback
        traceback.print_exc()
        error_msg = str(e).lower()
        if "tesseract" in error_msg or "tesseractnotfounderror" in str(type(e)).lower():
            raise HTTPException(status_code=500, detail=f"Erreur Tesseract: {e}. Vérifiez l'installation.")
        if "poppler" in error_msg:
            raise HTTPException(status_code=500, detail="Poppler n'est pas installé. L'extraction de PDF scannés est impossible.")
        raise HTTPException(status_code=500, detail=f"Erreur extraction texte : {str(e)}")

    if not lignes:
        raise HTTPException(status_code=422, detail="Aucun texte extrait du document")

    texte_joint = "\n".join(lignes)

    # ── Extraction des champs ──────────────────────────────────────────────
    # Utilisation exclusive des Regex car le modèle CRF actuel (dummy) fausse les données.
    donnees = extraire_avec_regex(texte_joint)

    # Identifiants légaux (regex toujours, même avec CRF)
    identifiants: list[str] = []
    for p in PATTERNS["identifiants"]:
        for m in re.finditer(p, texte_joint, re.IGNORECASE):
            identifiants.append(m.group(0).strip())
    donnees["identifiants"] = list(set(identifiants))

    # ── Score de confiance ────────────────────────────────────────────────
    champs_cles = ["fournisseur", "numero_facture", "date_emission", "total_ttc"]
    nb_ok = sum(1 for c in champs_cles if donnees.get(c))
    confiance = f"{nb_ok}/4"

    # Les lignes d'articles sont désormais retournées par extraire_avec_regex
    lignes_facture = donnees.get("lignes", [])

    # Print debug info to logs
    print(f"[OCR] Texte brut extrait ({len(texte_joint)} chars): {texte_joint[:500]}")
    print(f"[OCR] Champs extraits: fournisseur={donnees.get('fournisseur')}, client={donnees.get('client')}, total_ttc={donnees.get('total_ttc')}, lignes={len(lignes_facture)}")

    return OcrResultat(
        fournisseur      = donnees.get("fournisseur"),
        client           = donnees.get("client"),
        numero_facture   = donnees.get("numero_facture"),
        date_emission    = donnees.get("date_emission"),
        total_ht         = donnees.get("total_ht"),
        tva              = donnees.get("tva"),
        total_ttc        = donnees.get("total_ttc"),
        devise           = donnees.get("devise"),
        lignes           = [LigneFacture(**lf) for lf in lignes_facture],
        identifiants     = donnees.get("identifiants", []),
        confiance        = confiance,
        methode          = donnees.get("methode", "regex"),
        temps_traitement = round(time.time() - debut, 2),
        texte_brut       = texte_joint,  # toujours inclus pour debug
    )


@app.get("/")
async def racine():
    return {
        "service":    "Comptabli OCR",
        "endpoints":  ["/extraire (POST)", "/sante (GET)"],
        "docs":       "/docs",
    }

# Exposition des métriques Prometheus
Instrumentator().instrument(app).expose(app)
