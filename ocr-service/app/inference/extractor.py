"""
app/inference/extractor.py
===========================
Extraction intelligente par modèle CRF avec fusion conditionnelle Regex.

AMÉLIORATION 3 — Seuils de confiance par entité
  Chaque label possède son propre seuil. Si la confiance CRF d'un champ
  est inférieure à son seuil, on utilise la valeur Regex pour CE champ
  uniquement (fusion intelligente champ par champ, pas de fallback global).

AMÉLIORATION 2 — Prise en charge des features spatiales
  La méthode extract() accepte désormais spatial_data + page dimensions
  provenant de pytesseract.image_to_data().
"""

import os
import pickle
import logging
from typing import Optional, Dict, Any, List

from app.ml.features import text2features, text2tokens, tesseract_data_to_spatial
from app.preprocessing.cleaner import clean_text

logger = logging.getLogger("extractor")

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "../../modeles/crf_invoice_model.pkl"
)

# ═══════════════════════════════════════════════════════════════════════════════
# AMÉLIORATION 3 — Seuils de confiance par label
# ═══════════════════════════════════════════════════════════════════════════════

SEUILS_CONFIANCE: Dict[str, float] = {
    "TOTAL_TTC":        0.82,   # Champ critique — montant final TTC
    "TOTAL_HT":         0.80,   # Montant HT (base de calcul TVA)
    "TVA":              0.78,   # Taux ou montant TVA
    "NUMERO_FACTURE":   0.75,   # Identifiant unique de la facture
    "DATE":             0.65,   # Date d'émission (formats variables)
    "FOURNISSEUR":      0.68,   # Nom du fournisseur
    "CLIENT":           0.68,   # Nom du client
    "ARTICLE":          0.60,   # Lignes d'articles (structure variable)
    "DEVISE":           0.70,   # Symbole monétaire
    "SIRET":            0.72,   # SIRET / ICE / identifiant légal
}

# Seuil par défaut pour les labels non listés
SEUIL_DEFAUT = 0.70

# Mapping label CRF → clé dans le dict de sortie OcrResultat
_LABEL_TO_FIELD = {
    "TOTAL_TTC":      "total_ttc",
    "TOTAL_HT":       "total_ht",
    "TVA":            "tva",
    "NUMERO_FACTURE": "numero_facture",
    "NUMERO":         "numero_facture",   # alias depuis alignment.py
    "DATE":           "date_emission",
    "FOURNISSEUR":    "fournisseur",
    "CLIENT":         "client",
    "DEVISE":         "devise",
    "SIRET":          "identifiants",
}


class InvoiceExtractor:
    """
    Extracteur de factures basé sur un modèle CRF avec fusion intelligente Regex.

    Usage
    -----
    extractor = InvoiceExtractor()

    # Sans données spatiales (mode texte seul — comme avant)
    result = extractor.extract(texte_brut)

    # Avec données spatiales Tesseract (mode image enrichi)
    result = extractor.extract(
        texte_brut,
        tess_data=pytesseract.image_to_data(..., output_type=Output.DICT),
        page_width=img.width,
        page_height=img.height,
    )

    # Avec fusion Regex par champ
    result = extractor.extract(texte_brut, regex_result=extraire_avec_regex(texte_brut))
    """

    def __init__(self):
        self.crf_model = None
        self.load_model()

    def load_model(self):
        if os.path.exists(MODEL_PATH):
            try:
                with open(MODEL_PATH, "rb") as f:
                    self.crf_model = pickle.load(f)
                logger.info(f"[OK] CRF Model loaded from {MODEL_PATH}")
            except Exception as e:
                logger.error(f"[ERROR] Impossible de charger le modèle CRF : {e}")
                self.crf_model = None
        else:
            logger.warning(f"[WARN] CRF Model not found at {MODEL_PATH}. Fallback Regex sera utilisé.")

    # ─────────────────────────────────────────────────────────────────────────
    # EXTRACTION PRINCIPALE
    # ─────────────────────────────────────────────────────────────────────────

    def extract(
        self,
        text: str,
        tess_data: Optional[Dict] = None,
        page_width: float = 1.0,
        page_height: float = 1.0,
        regex_result: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Extrait les champs d'une facture et retourne un dict structuré.

        Paramètres
        ----------
        text         : texte brut OCR de la facture
        tess_data    : dict retourné par pytesseract.image_to_data() (optionnel)
                       → active les features spatiales
        page_width   : largeur de la page en pixels (pour normaliser x)
        page_height  : hauteur de la page en pixels (pour normaliser y)
        regex_result : résultat de extraire_avec_regex() (optionnel)
                       → utilisé comme fallback par champ si CRF < seuil

        Retourne
        --------
        {
            "total_ttc":   {"value": "1200.000", "confidence": 0.91, "source": "crf"},
            "fournisseur": {"value": "ACME",     "confidence": 0.62, "source": "regex"},
            ...
            "global_confidence_score": 0.82,
            "method": "crf+regex_fusion",
        }
        """
        if not self.crf_model:
            raise ValueError("Modèle CRF non chargé.")

        cleaned_text = clean_text(text)
        tokens = text2tokens(cleaned_text)
        if not tokens:
            return {"method": "crf", "global_confidence_score": 0.0}

        # ── Features spatiales optionnelles ──────────────────────────────────
        spatial_data: Optional[List[Dict]] = None
        if tess_data is not None:
            try:
                spatial_data = tesseract_data_to_spatial(tess_data)
            except Exception as e:
                logger.warning(f"[WARN] Extraction spatiale échouée : {e}")
                spatial_data = None

        # ── Inférence CRF ────────────────────────────────────────────────────
        features = [text2features(
            cleaned_text,
            spatial_data=spatial_data,
            page_width=page_width,
            page_height=page_height,
        )]

        predictions  = self.crf_model.predict(features)[0]
        marginals    = self.crf_model.predict_marginals(features)[0]

        # ── Groupement des entités BIO ────────────────────────────────────────
        crf_entities: Dict[str, Dict] = {}   # field → {value, confidence}
        confidences_list: List[float] = []

        current_type:   Optional[str]   = None
        current_tokens: List[str]       = []
        current_confs:  List[float]     = []

        def _save_entity():
            nonlocal current_type, current_tokens, current_confs
            if current_type and current_tokens:
                val      = " ".join(current_tokens)
                avg_conf = sum(current_confs) / len(current_confs)
                field    = _LABEL_TO_FIELD.get(current_type, current_type.lower())

                # Garder l'entité avec la confiance la plus haute pour ce champ
                if field not in crf_entities or crf_entities[field]["confidence"] < avg_conf:
                    crf_entities[field] = {
                        "value":      val,
                        "confidence": round(avg_conf, 4),
                        "source":     "crf",
                    }
                confidences_list.append(avg_conf)
            current_type   = None
            current_tokens = []
            current_confs  = []

        for token, label, probs in zip(tokens, predictions, marginals):
            if label == "O":
                _save_entity()
                continue

            parts  = label.split("-", 1)
            if len(parts) != 2:
                _save_entity()
                continue
            prefix, entity_type = parts
            prob = float(probs.get(label, 0.0))

            if prefix == "B":
                _save_entity()
                current_type   = entity_type
                current_tokens = [token]
                current_confs  = [prob]
            elif prefix == "I" and current_type == entity_type:
                current_tokens.append(token)
                current_confs.append(prob)
            else:
                _save_entity()
                current_type   = entity_type
                current_tokens = [token]
                current_confs  = [prob]

        _save_entity()   # Sauvegarder la dernière entité

        # ── AMÉLIORATION 3 : Fusion intelligente CRF + Regex par champ ───────
        extracted_data = dict(crf_entities)

        if regex_result is not None:
            # Mapping clés OcrResultat → label CRF (inverse de _LABEL_TO_FIELD)
            _FIELD_TO_LABEL = {v: k for k, v in _LABEL_TO_FIELD.items()}

            for field, regex_val in regex_result.items():
                if field in ("methode", "lignes", "identifiants") or not regex_val:
                    continue

                label_crf = _FIELD_TO_LABEL.get(field, field.upper())
                seuil     = SEUILS_CONFIANCE.get(label_crf, SEUIL_DEFAUT)

                crf_entry = extracted_data.get(field)

                if crf_entry is None:
                    # CRF n'a rien trouvé → utiliser Regex directement
                    extracted_data[field] = {
                        "value":      str(regex_val),
                        "confidence": 0.50,
                        "source":     "regex_fallback",
                    }
                    logger.debug(f"[FUSION] {field}: CRF absent → Regex utilisé ({regex_val})")

                elif crf_entry["confidence"] < seuil:
                    # CRF présent mais confiance insuffisante → préférer Regex
                    old_conf = crf_entry["confidence"]
                    extracted_data[field] = {
                        "value":      str(regex_val),
                        "confidence": 0.55,          # confiance estimée pour Regex
                        "source":     "regex_fusion",
                        "crf_conf_rejected": old_conf,
                        "seuil":      seuil,
                    }
                    logger.debug(
                        f"[FUSION] {field}: CRF conf {old_conf:.3f} < seuil {seuil} "
                        f"→ Regex utilisé ({regex_val})"
                    )
                else:
                    # CRF au-dessus du seuil → on garde CRF
                    logger.debug(
                        f"[FUSION] {field}: CRF conf {crf_entry['confidence']:.3f} "
                        f">= seuil {seuil} → CRF conservé"
                    )

        # ── Score de confiance global ─────────────────────────────────────────
        global_conf = (
            sum(confidences_list) / len(confidences_list)
            if confidences_list else 0.0
        )

        # Déterminer la méthode finale
        sources = {v.get("source", "crf") for v in extracted_data.values() if isinstance(v, dict)}
        if "regex_fusion" in sources or "regex_fallback" in sources:
            method = "crf+regex_fusion"
        else:
            method = "crf"

        extracted_data["global_confidence_score"] = round(global_conf, 4)
        extracted_data["method"] = method

        return extracted_data
