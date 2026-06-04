"""
Micro-service FastAPI pour l'extraction d'entités de factures.

Ce serveur expose un endpoint POST /extract qui :
1. Reçoit le texte brut d'une facture (sorti de Tesseract OCR)
2. Le passe dans le modèle NER spaCy entraîné
3. Retourne les entités structurées (fournisseur, montant, TVA, date, etc.)

Le backend NestJS appelle ce service au lieu de Gemini/OpenAI.

Usage :
    uvicorn app:app --host 0.0.0.0 --port 5001
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import spacy
import os
import re

# --- Configuration ---
MODEL_PATH = os.path.join(os.path.dirname(__file__), "models", "invoice_ner")

app = FastAPI(
    title="Comptabli ML - Invoice NER Service",
    description="Micro-service d'extraction d'entités comptables via spaCy NER",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Charger le modèle au démarrage ---
nlp = None

@app.on_event("startup")
def load_model():
    global nlp
    if os.path.exists(MODEL_PATH):
        nlp = spacy.load(MODEL_PATH)
        print(f"✅ Modèle NER chargé depuis {MODEL_PATH}")
    else:
        print(f"⚠️  Modèle non trouvé à {MODEL_PATH}. Lancez 'python train_ner.py' d'abord.")
        print("   Le service fonctionnera en mode Regex de secours.")


# --- Modèles Pydantic ---
class ExtractionRequest(BaseModel):
    text: str
    category: str = "Facturation"  # Facturation, Devis, Bilan

class EntityResult(BaseModel):
    label: str
    value: str
    confidence: float = 0.0

class ExtractionResponse(BaseModel):
    type: str
    entities: list[EntityResult]
    structured: dict
    summary: str


# --- Extraction par Regex (mode de secours) ---
def extract_with_regex(text: str) -> dict:
    """Extraction basée sur des expressions régulières — fallback si le modèle NER n'est pas disponible."""
    
    result = {
        "invoiceNumber": None,
        "date": None,
        "vendorName": None,
        "clientName": None,
        "totalHT": None,
        "totalTVA": None,
        "totalTTC": None,
        "tvaPercent": None,
        "currency": None,
        "iban": None,
    }

    # Numéro de facture
    match = re.search(r'(?:facture|invoice|fact|fac)\s*(?:n[°o.]?|num[ée]ro|no|ref|r[ée]f[ée]rence)\s*[:\s]*([A-Z0-9\-/]+)', text, re.IGNORECASE)
    if match:
        result["invoiceNumber"] = match.group(1).strip()

    # Dates (format JJ/MM/AAAA ou AAAA-MM-JJ)
    dates = re.findall(r'\b(\d{2}/\d{2}/\d{4}|\d{4}-\d{2}-\d{2}|\d{1,2}\s+(?:janvier|f[ée]vrier|mars|avril|mai|juin|juillet|ao[ûu]t|septembre|octobre|novembre|d[ée]cembre)\s+\d{4})\b', text, re.IGNORECASE)
    if dates:
        result["date"] = dates[0]

    # Total TTC
    match = re.search(r'(?:total\s*(?:ttc|toutes\s*taxes|[àa]\s*payer|net)|montant\s*total\s*ttc|grand\s*total|net\s*[àa]\s*payer)\s*[:\s]*(\d[\d\s,.]*\d)', text, re.IGNORECASE)
    if match:
        result["totalTTC"] = match.group(1).replace(" ", "").replace(",", ".")

    # Total HT
    match = re.search(r'(?:total\s*(?:ht|hors\s*taxes)|sous[- ]?total\s*(?:ht)?|subtotal|montant\s*ht|total\s*honoraires\s*ht)\s*[:\s]*(\d[\d\s,.]*\d)', text, re.IGNORECASE)
    if match:
        result["totalHT"] = match.group(1).replace(" ", "").replace(",", ".")

    # TVA montant
    match = re.search(r'(?:tva|taxe|vat)\s*(?:\d+\s*%\s*)?[:\s]*(\d[\d\s,.]*\d)', text, re.IGNORECASE)
    if match:
        result["totalTVA"] = match.group(1).replace(" ", "").replace(",", ".")

    # TVA pourcentage
    match = re.search(r'(?:tva|vat)\s*[:\s]*(\d+(?:[.,]\d+)?)\s*%', text, re.IGNORECASE)
    if match:
        result["tvaPercent"] = match.group(1).replace(",", ".")

    # Devise
    for dev in ["EUR", "TND", "USD", "GBP", "MAD", "DZD"]:
        if dev in text.upper():
            result["currency"] = dev
            break

    # IBAN
    match = re.search(r'(?:iban|rib)\s*[:\s]*([A-Z]{2}\d{2}[\s\d]+\d)', text, re.IGNORECASE)
    if match:
        result["iban"] = match.group(1).strip()

    # Fournisseur (après "Émetteur:", "De:", "Par:", "From:")
    match = re.search(r'(?:[ÉE]metteur|[ée]mise?\s*par|par|de|from|soci[ée]t[ée]|entreprise)\s*[:\s]+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s&]+(?:SA|SARL|SAS|EURL|SNC)?)', text, re.IGNORECASE)
    if match:
        result["vendorName"] = match.group(1).strip()

    # Client (après "Client:", "Pour:", "Destinataire:", "Bill To:", "À l'attention de:")
    match = re.search(r"(?:client|pour|destinataire|bill\s*to|[àa]\s*l'attention\s*de|au\s*profit\s*de)\s*[:\s]+([A-ZÀ-Ÿ][A-Za-zÀ-ÿ\s&]+(?:SA|SARL|SAS|EURL|SNC)?)", text, re.IGNORECASE)
    if match:
        result["clientName"] = match.group(1).strip()

    return result


# --- Endpoint principal ---
@app.post("/extract", response_model=ExtractionResponse)
async def extract_entities(request: ExtractionRequest):
    """
    Extrait les entités comptables du texte brut d'une facture.
    Utilise le modèle NER spaCy s'il est disponible, sinon le mode Regex.
    """
    text = request.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Le texte ne peut pas être vide.")

    entities = []
    structured = {}

    if nlp is not None:
        # --- Mode NER spaCy (modèle entraîné) ---
        doc = nlp(text)
        
        for ent in doc.ents:
            entities.append(EntityResult(
                label=ent.label_,
                value=ent.text,
                confidence=round(ent._.get("confidence", 0.85) if hasattr(ent._, "confidence") else 0.85, 2)
            ))

        # Construire le dictionnaire structuré à partir des entités
        for ent in doc.ents:
            key_map = {
                "FOURNISSEUR": "vendorName",
                "CLIENT": "clientName",
                "NUM_FACTURE": "invoiceNumber",
                "DATE": "date",
                "MONTANT_HT": "totalHT",
                "MONTANT_TVA": "totalTVA",
                "MONTANT_TTC": "totalTTC",
                "TVA_PERCENT": "tvaPercent",
                "DEVISE": "currency",
                "IBAN": "iban",
            }
            key = key_map.get(ent.label_)
            if key and key not in structured:
                structured[key] = ent.text

    else:
        # --- Mode Regex (fallback) ---
        structured = extract_with_regex(text)
        for key, value in structured.items():
            if value:
                entities.append(EntityResult(label=key.upper(), value=value, confidence=0.60))

    # Compléter les champs manquants avec le Regex
    regex_result = extract_with_regex(text)
    for key, value in regex_result.items():
        if value and key not in structured:
            structured[key] = value

    # Déterminer le type de document
    doc_type = "FACTURE"
    if request.category == "Devis":
        doc_type = "DEVIS"
    elif request.category == "Bilan":
        doc_type = "BILAN"

    # Générer le résumé lisible
    summary = generate_summary(doc_type, structured)

    return ExtractionResponse(
        type=doc_type,
        entities=entities,
        structured=structured,
        summary=summary
    )


def generate_summary(doc_type: str, data: dict) -> str:
    """Génère un résumé textuel formaté à partir des données extraites."""
    
    if doc_type == "FACTURE":
        lines = [
            "FACTURE EXTRAITE",
            "----------------",
            f"N° Facture       : {data.get('invoiceNumber', 'Non trouvé')}",
            f"Date             : {data.get('date', 'Non trouvé')}",
            f"Fournisseur      : {data.get('vendorName', 'Non trouvé')}",
            f"Client           : {data.get('clientName', 'Non trouvé')}",
            "",
            f"Sous-total HT    : {data.get('totalHT', 'Non trouvé')} {data.get('currency', '')}",
            f"TVA ({data.get('tvaPercent', '?')}%)      : {data.get('totalTVA', 'Non trouvé')} {data.get('currency', '')}",
            f"TOTAL TTC        : {data.get('totalTTC', 'Non trouvé')} {data.get('currency', '')}",
        ]
        if data.get("iban"):
            lines.append(f"IBAN             : {data['iban']}")
        return "\n".join(lines)

    elif doc_type == "DEVIS":
        return "\n".join([
            "DEVIS TRAITÉ",
            "------------",
            f"Objet            : {data.get('vendorName', 'Non trouvé')}",
            f"Montant total    : {data.get('totalTTC', 'Non trouvé')} {data.get('currency', '')}",
            f"Date             : {data.get('date', 'Non trouvé')}",
        ])
    
    elif doc_type == "BILAN":
        return "\n".join([
            "BILAN TRAITÉ",
            "------------",
            f"Période          : {data.get('date', 'Non trouvé')}",
            f"Total Actif      : {data.get('totalHT', 'Non trouvé')} {data.get('currency', '')}",
            f"Résultat net     : {data.get('totalTTC', 'Non trouvé')} {data.get('currency', '')}",
        ])
    
    return "Type de document non reconnu."


# --- Health Check ---
@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "model_loaded": nlp is not None,
        "model_path": MODEL_PATH,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=5001)
