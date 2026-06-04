import io
import cv2
import numpy as np
import pytesseract
from itertools import groupby
from typing import Optional, Dict, Any
from pdf2image import convert_from_bytes
from PIL import Image, ImageEnhance, ImageFilter
import pdfplumber
import os

# Configuration du chemin Tesseract (utile si la variable d'environnement PATH n'a pas été rechargée)
tesseract_path = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
if os.path.exists(tesseract_path):
    pytesseract.pytesseract.tesseract_cmd = tesseract_path

# Utiliser le dossier tessdata local qui contient fra.traineddata
os.environ["TESSDATA_PREFIX"] = r'c:\comptabli\ocr-service\tessdata'

# Configuration Tesseract pour les factures (PSM 6 = bloc uniforme)
_TESS_CONFIG = r"--oem 3 --psm 6 -c preserve_interword_spaces=1"
_TESS_LANG = "fra+eng"

# ═══════════════════════════════════════════════════════════════════════════════
# AMÉLIORATION 1 — Score de qualité image avant OCR
# ═══════════════════════════════════════════════════════════════════════════════

def score_qualite_image(img: Image.Image) -> Dict[str, Any]:
    """
    Analyse la qualité d'une image avant OCR.

    Critères évalués :
      - Variance du Laplacien  → détecte le flou
      - Luminosité moyenne      → détecte images trop sombres / surexposées

    Retourne un dict ::
        {
          "score":   float,   # 0.0 (mauvais) → 1.0 (parfait)
          "statut":  str,     # "ok" | "flou" | "sombre" | "surexpose"
          "message": str,     # message lisible pour l'utilisateur
          "details": dict,    # variance_laplacien + luminosite_moyenne
        }
    """
    # Convertir PIL → OpenCV (niveaux de gris)
    img_gray = img.convert("L")
    img_cv = np.array(img_gray, dtype=np.uint8)

    # ── 1. Détection du flou via variance du Laplacien ─────────────────────
    laplacian_var = float(cv2.Laplacian(img_cv, cv2.CV_64F).var())
    # Seuil empirique : < 50 → flou notable pour un document A4 à 200+ DPI
    SEUIL_FLOU = 50.0
    est_flou = laplacian_var < SEUIL_FLOU

    # ── 2. Luminosité moyenne ──────────────────────────────────────────────
    luminosite = float(img_cv.mean())   # 0 = noir, 255 = blanc
    SEUIL_SOMBRE    = 35.0   # < 35  → vraiment trop sombre (quasi noir)
    SEUIL_SUREXPOSE = 252.0  # > 252 → surexposé (fond complètement blanc brûlé)
    # NOTE : les factures sur fond blanc ont naturellement 230-250 de luminosité
    # Un seuil à 230 rejetterait tous les documents normaux !
    est_sombre    = luminosite < SEUIL_SOMBRE
    est_surexpose = luminosite > SEUIL_SUREXPOSE

    # ── 3. Score composite (0 → 1) ─────────────────────────────────────────
    # Score flou : normalise la variance entre 0 et 1 (plafonnée à 500)
    score_flou = min(laplacian_var / 500.0, 1.0)
    # Score luminosité : 1.0 si 80–200, dégrade linéairement aux extrêmes
    lum_norm = luminosite / 255.0
    if lum_norm < 0.31:   # trop sombre
        score_lum = lum_norm / 0.31
    elif lum_norm > 0.90:  # surexposé
        score_lum = (1.0 - lum_norm) / 0.10
    else:
        score_lum = 1.0
    score_global = round((score_flou * 0.6 + score_lum * 0.4), 3)

    # ── 4. Statut final ────────────────────────────────────────────────────
    if est_sombre:
        statut  = "sombre"
        message = (
            f"L'image est trop sombre (luminosité moyenne = {luminosite:.1f}/255). "
            "Veuillez scanner votre document avec un meilleur éclairage."
        )
    elif est_surexpose:
        statut  = "surexpose"
        message = (
            f"L'image est surexposée (luminosité moyenne = {luminosite:.1f}/255). "
            "Réduisez la luminosité de votre scanner ou évitez les reflets."
        )
    elif est_flou:
        statut  = "flou"
        message = (
            f"L'image est floue (variance Laplacien = {laplacian_var:.1f} < {SEUIL_FLOU}). "
            "Assurez-vous que le document est bien à plat et la mise au point correcte."
        )
    else:
        statut  = "ok"
        message = "Qualité image acceptable pour l'OCR."

    return {
        "score":   score_global,
        "statut":  statut,
        "message": message,
        "details": {
            "variance_laplacien": round(laplacian_var, 2),
            "luminosite_moyenne": round(luminosite, 2),
        },
    }


def ameliorer_image(img: Image.Image, target_dpi: int = 300) -> Image.Image:
    """Pré-traitement amélioré pour maximiser la qualité OCR Tesseract."""
    # 1. Convertir en niveaux de gris
    img = img.convert("L")

    # 2. Agrandir si l'image est trop petite (Tesseract préfère 300+ DPI)
    min_width = 1800  # ~A4 à 200 DPI
    if img.width < min_width:
        scale = min_width / img.width
        new_w = int(img.width * scale)
        new_h = int(img.height * scale)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    # 3. Augmenter le contraste
    img = ImageEnhance.Contrast(img).enhance(2.5)

    # 4. Binarisation par seuil adaptatif simple
    threshold = 180
    img = img.point(lambda p: 255 if p > threshold else 0)

    # 5. Réduction du bruit
    img = img.filter(ImageFilter.MedianFilter(size=3))

    return img

def detecter_coupure_colonnes(words: list, largeur: float) -> Optional[float]:
    """Détecte automatiquement une zone vide centrale = 2 colonnes."""
    if not words:
        return None
    nb = 20
    tranches = [0] * nb
    for w in words:
        cx = (w["x0"] + w["x1"]) / 2
        idx = min(int(cx / largeur * nb), nb - 1)
        tranches[idx] += 1
    debut, fin = int(nb * 0.30), int(nb * 0.70)
    zone = tranches[debut:fin]
    if not zone or max(tranches) == 0:
        return None
    min_v = min(zone)
    idx_c = tranches.index(min_v, debut, fin)
    if min_v / max(tranches) < 0.3:
        return (idx_c / nb) * largeur
    return None

def extraire_lignes_pdf(contenu: bytes) -> list[str]:
    """
    Extraction intelligente depuis PDF.
    1. Tente extraction native (PDF numérique).
    2. Si trop peu de texte → OCR (PDF scanné).
    Gère automatiquement les PDFs à 2 colonnes.
    """
    toutes_lignes = []

    with pdfplumber.open(io.BytesIO(contenu)) as pdf:
        for page in pdf.pages:
            words = page.extract_words()

            if not words:
                # PDF scanné : OCR via Tesseract
                images = convert_from_bytes(contenu, dpi=300)
                for img in images:
                    img_am = ameliorer_image(img)
                    texte = pytesseract.image_to_string(img_am, lang=_TESS_LANG, config=_TESS_CONFIG)
                    toutes_lignes += [l.strip() for l in texte.splitlines() if l.strip()]
                continue

            # Détecter si 2 colonnes (gap central)
            largeur = float(page.width)
            coupure = detecter_coupure_colonnes(words, largeur)

            # Reconstruire les lignes ligne par ligne (grouper par Y)
            words_tries = sorted(words, key=lambda w: (round(w["top"] / 4), w["x0"]))
            for _y, groupe in groupby(words_tries, key=lambda w: round(w["top"] / 4)):
                mots = sorted(groupe, key=lambda w: w["x0"])
                if coupure:
                    gauche = [m for m in mots if m["x0"] < coupure]
                    droite = [m for m in mots if m["x0"] >= coupure]
                    if gauche:
                        t = " ".join(m["text"] for m in gauche).strip()
                        if t:
                            toutes_lignes.append(t)
                    if droite:
                        t = " ".join(m["text"] for m in droite).strip()
                        if t:
                            toutes_lignes.append(t)
                else:
                    t = " ".join(m["text"] for m in mots).strip()
                    if t:
                        toutes_lignes.append(t)

    return toutes_lignes

def extraire_lignes_image(contenu: bytes) -> list[str]:
    """OCR avec positions pour détecter les 2 colonnes dans les images."""
    img = Image.open(io.BytesIO(contenu))
    img_am = ameliorer_image(img)

    data = pytesseract.image_to_data(
        img_am, lang=_TESS_LANG, config=_TESS_CONFIG,
        output_type=pytesseract.Output.DICT
    )
    words = [
        {"text": data["text"][i], "x0": data["left"][i],
         "x1": data["left"][i] + data["width"][i], "top": data["top"][i]}
        for i in range(len(data["text"]))
        if data["text"][i].strip() and int(data["conf"][i]) > 20  # seuil plus permissif
    ]
    if not words:
        return []

    coupure = detecter_coupure_colonnes(words, img.width)
    words_tries = sorted(words, key=lambda w: (round(w["top"] / 4), w["x0"]))
    lignes = []
    for _y, groupe in groupby(words_tries, key=lambda w: round(w["top"] / 4)):
        mots = sorted(groupe, key=lambda w: w["x0"])
        if coupure:
            gauche = [m for m in mots if m["x0"] < coupure]
            droite = [m for m in mots if m["x0"] >= coupure]
            for col in [gauche, droite]:
                t = " ".join(m["text"] for m in col).strip()
                if t:
                    lignes.append(t)
        else:
            t = " ".join(m["text"] for m in mots).strip()
            if t:
                lignes.append(t)
    return lignes
