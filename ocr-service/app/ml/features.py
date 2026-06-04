"""
app/ml/features.py
==================
Extraction des features CRF pour chaque token d'une facture.

AMÉLIORATION 2 — Features spatiales enrichies :
  - x_norm, y_norm  : position normalisée 0.0→1.0 sur la page
  - is_top          : y_norm < 0.25 (zone en-tête)
  - is_bottom       : y_norm > 0.75 (zone pied de page)
  - is_right_col    : x_norm > 0.60 (colonne droite — souvent les montants)
  - is_numeric      : token purement numérique ou décimal
  - is_percentage   : token contient '%'
  - is_currency_symbol : token est un symbole monétaire
  - Les features contextuelles -1/-2/+1/+2 sont inchangées

Structure des données spatiales attendue
-----------------------------------------
Chaque token peut être accompagné de coordonnées :
    token_data = {
        "text": str,
        "x0": int,      # left
        "x1": int,      # right
        "top": int,     # top (Y du coin supérieur)
        "conf": int,    # confiance Tesseract (0-100)
    }
Quand les coordonnées ne sont pas disponibles, x_norm = y_norm = 0.5 (neutre).
"""

import re
from typing import List, Dict, Any, Optional

DEVISES_RE = re.compile(r"^(EUR|€|TND|DT|MAD|USD|\$|GBP|£|CHF|CAD|AED|XOF)$", re.IGNORECASE)
NUMERIC_RE  = re.compile(r"^\d+([.,]\d+)?$")
PERCENT_RE  = re.compile(r"%")


# ═══════════════════════════════════════════════════════════════════════════════
# HELPERS
# ═══════════════════════════════════════════════════════════════════════════════

def get_shape(word: str) -> str:
    """Returns the shape of a word. Ex: 'Invoice' -> 'Xxxxx', '123' -> 'ddd'"""
    shape = []
    for c in word:
        if c.isupper(): shape.append('X')
        elif c.islower(): shape.append('x')
        elif c.isdigit(): shape.append('d')
        else: shape.append(c)
    return "".join(shape)


# ═══════════════════════════════════════════════════════════════════════════════
# FEATURE BUILDER — UN TOKEN AVEC CONTEXTE TEXTUEL + SPATIAL
# ═══════════════════════════════════════════════════════════════════════════════

def word2features(
    doc: List[str],
    i: int,
    spatial_data: Optional[List[Dict[str, Any]]] = None,
    page_width: float = 1.0,
    page_height: float = 1.0,
    prev_label: Optional[str] = None,
    next_label: Optional[str] = None,
) -> dict:
    """
    Calcule le vecteur de features pour le token à l'index i.

    Paramètres
    ----------
    doc          : liste de tokens (str)
    i            : index du token courant
    spatial_data : liste de dicts {x0, x1, top, conf} par token (optionnel)
    page_width   : largeur de la page en pixels (pour normalisation)
    page_height  : hauteur de la page en pixels (pour normalisation)
    prev_label   : label CRF prédit pour le token précédent (contexte)
    next_label   : label CRF prédit pour le token suivant (contexte)
    """
    word = doc[i]

    # ── Features textuelles de base ─────────────────────────────────────────
    features = {
        'bias':                1.0,
        'word.lower()':        word.lower(),
        'word[-3:]':           word[-3:],
        'word[-2:]':           word[-2:],
        'word.isupper()':      word.isupper(),
        'word.istitle()':      word.istitle(),
        'word.isdigit()':      word.isdigit(),
        'word.shape':          get_shape(word),
        'word.is_currency()':  bool(DEVISES_RE.match(word)),
        'word.has_digit':      any(c.isdigit() for c in word),
        'word.length':         len(word),
        # Nouvelles features sémantiques
        'word.is_numeric':     bool(NUMERIC_RE.match(word)),
        'word.is_percentage':  bool(PERCENT_RE.search(word)),
        'word.is_currency_symbol': bool(DEVISES_RE.match(word)),
    }

    # ── Features spatiales (AMÉLIORATION 2) ─────────────────────────────────
    if spatial_data and i < len(spatial_data) and spatial_data[i]:
        sd = spatial_data[i]
        x0    = float(sd.get("x0", 0))
        x1    = float(sd.get("x1", x0))
        top   = float(sd.get("top", 0))
        pw    = max(page_width, 1.0)
        ph    = max(page_height, 1.0)

        # Centre horizontal du token normalisé
        x_norm = round(((x0 + x1) / 2.0) / pw, 3)
        # Position verticale normalisée
        y_norm = round(top / ph, 3)

        features.update({
            'spatial.x_norm':      x_norm,
            'spatial.y_norm':      y_norm,
            'spatial.is_top':      y_norm < 0.25,        # en-tête (logo, numéro facture…)
            'spatial.is_bottom':   y_norm > 0.75,        # pied de page (totaux, mentions légales)
            'spatial.is_right_col': x_norm > 0.60,       # colonne droite → montants
            'spatial.is_left_col': x_norm < 0.40,        # colonne gauche → descriptions
            'spatial.conf':        float(sd.get("conf", 100)) / 100.0,  # confiance Tesseract [0,1]
        })
    else:
        # Pas de données spatiales : valeurs neutres (n'influencent pas le CRF)
        features.update({
            'spatial.x_norm':       0.5,
            'spatial.y_norm':       0.5,
            'spatial.is_top':       False,
            'spatial.is_bottom':    False,
            'spatial.is_right_col': False,
            'spatial.is_left_col':  False,
            'spatial.conf':         1.0,
        })

    # ── Contexte d'étiquettes CRF (AMÉLIORATION 2 — prev/next label) ────────
    if prev_label is not None:
        features['prev_token_label'] = prev_label
    if next_label is not None:
        features['next_token_label'] = next_label

    # ── Contexte textuel mot précédent ──────────────────────────────────────
    if i > 0:
        word1 = doc[i - 1]
        features.update({
            '-1:word.lower()':        word1.lower(),
            '-1:word.istitle()':      word1.istitle(),
            '-1:word.isupper()':      word1.isupper(),
            '-1:word.isdigit()':      word1.isdigit(),
            '-1:word.is_currency()':  bool(DEVISES_RE.match(word1)),
            '-1:word.is_numeric':     bool(NUMERIC_RE.match(word1)),
        })
    else:
        features['BOS'] = True  # Beginning of sequence

    # ── Contexte textuel mot suivant ────────────────────────────────────────
    if i < len(doc) - 1:
        word1 = doc[i + 1]
        features.update({
            '+1:word.lower()':        word1.lower(),
            '+1:word.istitle()':      word1.istitle(),
            '+1:word.isupper()':      word1.isupper(),
            '+1:word.isdigit()':      word1.isdigit(),
            '+1:word.is_currency()':  bool(DEVISES_RE.match(word1)),
            '+1:word.is_numeric':     bool(NUMERIC_RE.match(word1)),
        })
    else:
        features['EOS'] = True  # End of sequence

    # ── Contexte étendu -2 / +2 ─────────────────────────────────────────────
    if i > 1:
        word2 = doc[i - 2]
        features['-2:word.lower()'] = word2.lower()
    if i < len(doc) - 2:
        word2 = doc[i + 2]
        features['+2:word.lower()'] = word2.lower()

    return features


# ═══════════════════════════════════════════════════════════════════════════════
# API PUBLIQUE — Transformations texte → features
# ═══════════════════════════════════════════════════════════════════════════════

def text2tokens(text: str) -> List[str]:
    """Tokenise un texte (mots + ponctuation séparée)."""
    return re.findall(r"\w+|[^\w\s]", text)


def text2features(
    text: str,
    spatial_data: Optional[List[Dict[str, Any]]] = None,
    page_width: float = 1.0,
    page_height: float = 1.0,
    labels: Optional[List[str]] = None,
) -> List[dict]:
    """
    Tokenise le texte et retourne les features CRF pour chaque token.

    Paramètres
    ----------
    text         : texte brut de la facture
    spatial_data : coordonnées Tesseract par token [{x0, x1, top, conf}]
                   Si None → features spatiales neutres
    page_width   : largeur de la page (pour normalisation)
    page_height  : hauteur de la page (pour normalisation)
    labels       : labels CRF déjà prédits (pour prev/next label context)
                   Si None → pas de contexte d'étiquette
    """
    tokens = text2tokens(text)
    feature_list = []

    for i, _ in enumerate(tokens):
        prev_lbl = labels[i - 1] if (labels and i > 0) else None
        next_lbl = labels[i + 1] if (labels and i < len(labels) - 1) else None

        feat = word2features(
            doc=tokens,
            i=i,
            spatial_data=spatial_data,
            page_width=page_width,
            page_height=page_height,
            prev_label=prev_lbl,
            next_label=next_lbl,
        )
        feature_list.append(feat)

    return feature_list


def tesseract_data_to_spatial(tess_data: dict) -> List[Dict[str, Any]]:
    """
    Convertit la sortie de pytesseract.image_to_data() en liste de dicts spatiaux
    alignée sur les tokens de text2tokens().

    Chaque mot Tesseract avec conf > 0 est inclus dans la liste résultat,
    dans le même ordre que les tokens du texte reconstruit.
    """
    spatial = []
    for i in range(len(tess_data["text"])):
        txt = tess_data["text"][i]
        if not txt.strip():
            continue
        conf = int(tess_data["conf"][i])
        if conf < 0:
            continue
        spatial.append({
            "text": txt,
            "x0":   tess_data["left"][i],
            "x1":   tess_data["left"][i] + tess_data["width"][i],
            "top":  tess_data["top"][i],
            "conf": conf,
        })
    return spatial
