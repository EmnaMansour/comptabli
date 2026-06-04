"""
CORRECTIF — Extraction Intelligente de Lignes PDF
===================================================
Résout le problème des PDFs à 2 colonnes où le texte gauche
et droite sont fusionnés sur la même ligne Y.

Exemples avant :
  "Société : Comptabli SARL Facture N° : F2026-002"  ← 1 seule ligne fusionnée
  "Adresse : Tunis, Tunisie Date : 27/04/2026"

Exemples après :
  "Société : Comptabli SARL"    ← colonne gauche
  "Facture N° : F2026-002"      ← colonne droite
  "Adresse : Tunis, Tunisie"
  "Date : 27/04/2026"

Usage :
  python correctif_lignes.py facture.pdf
  
Ou importer dans votre code :
  from correctif_lignes import extraire_lignes_intelligentes
"""

import sys, re
from pathlib import Path
from itertools import groupby

try:
    import pdfplumber
    from pdf2image import convert_from_path
    import pytesseract
    from PIL import Image
except ImportError:
    print("pip install pdfplumber pdf2image pytesseract pillow")
    sys.exit(1)


# ═══════════════════════════════════════════════════════════════════════════════
# DETECTION DE LA COUPURE DE COLONNES
# ═══════════════════════════════════════════════════════════════════════════════

def detecter_colonne_coupure(words: list, largeur_page: float) -> float:
    """
    Analyse la distribution des positions X des mots pour trouver
    automatiquement s'il y a une zone vide centrale (= 2 colonnes).
    
    Retourne la position X de coupure, ou None si pas de 2 colonnes.
    """
    if not words:
        return None

    # Diviser la page en 20 tranches verticales
    nb_tranches = 20
    tranches = [0] * nb_tranches

    for w in words:
        centre_x = (w["x0"] + w["x1"]) / 2
        tranche = min(int(centre_x / largeur_page * nb_tranches), nb_tranches - 1)
        tranches[tranche] += 1

    # Chercher une zone vide entre 30% et 70% de la largeur (zone centrale)
    debut_zone = int(nb_tranches * 0.30)
    fin_zone   = int(nb_tranches * 0.70)

    # Trouver la tranche avec le moins de mots dans la zone centrale
    min_mots  = min(tranches[debut_zone:fin_zone])
    idx_creux = tranches.index(min_mots, debut_zone, fin_zone)

    # Si la tranche creuse a significativement moins de mots → 2 colonnes
    max_mots = max(tranches)
    if max_mots > 0 and min_mots / max_mots < 0.3:
        coupure = (idx_creux / nb_tranches) * largeur_page
        return coupure

    return None  # Pas de 2 colonnes détectées


# ═══════════════════════════════════════════════════════════════════════════════
# RECONSTRUCTION DES LIGNES DEPUIS LES MOTS ET LEURS POSITIONS
# ═══════════════════════════════════════════════════════════════════════════════

def reconstruire_lignes(words: list, coupure_x: float = None,
                        tolerance_y: int = 4) -> list[str]:
    """
    Regroupe les mots par position Y (même ligne horizontale),
    puis si une coupure X est détectée, sépare en 2 colonnes.
    
    tolerance_y : mots dans un rayon de ±4px vertical = même ligne
    """
    if not words:
        return []

    # Trier par Y puis X
    words_sorted = sorted(words, key=lambda w: (round(w["top"] / tolerance_y), w["x0"]))

    # Grouper par position Y avec tolérance
    lignes_reconstruites = []
    for _y, groupe in groupby(words_sorted,
                              key=lambda w: round(w["top"] / tolerance_y)):
        mots = sorted(groupe, key=lambda w: w["x0"])

        if coupure_x:
            # Séparer en colonne gauche et droite
            gauche = [m for m in mots if m["x0"] < coupure_x]
            droite = [m for m in mots if m["x0"] >= coupure_x]

            if gauche:
                texte_gauche = " ".join(m["text"] for m in gauche).strip()
                if texte_gauche:
                    lignes_reconstruites.append(texte_gauche)

            if droite:
                texte_droite = " ".join(m["text"] for m in droite).strip()
                if texte_droite:
                    lignes_reconstruites.append(texte_droite)
        else:
            # Pas de 2 colonnes : garder la ligne entière
            texte = " ".join(m["text"] for m in mots).strip()
            if texte:
                lignes_reconstruites.append(texte)

    return lignes_reconstruites


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACTION DEPUIS PDF (NATIF OU SCANNÉ)
# ═══════════════════════════════════════════════════════════════════════════════

def extraire_lignes_pdf(chemin: str, debug: bool = False) -> list[str]:
    """
    Extraction intelligente depuis un PDF.
    Détecte automatiquement les 2 colonnes et les sépare.
    """
    toutes_lignes = []

    with pdfplumber.open(chemin) as pdf:
        for num_page, page in enumerate(pdf.pages):
            words = page.extract_words()

            if not words:
                # PDF scanné → OCR
                if debug:
                    print(f"  Page {num_page+1} : aucun mot natif → OCR")
                images = convert_from_path(chemin, dpi=300,
                                           first_page=num_page+1,
                                           last_page=num_page+1)
                for img in images:
                    texte = pytesseract.image_to_string(img, lang="fra+eng")
                    lignes = [l.strip() for l in texte.splitlines() if l.strip()]
                    toutes_lignes.extend(lignes)
                continue

            largeur = float(page.width)
            coupure = detecter_colonne_coupure(words, largeur)

            if debug:
                if coupure:
                    print(f"  Page {num_page+1} : 2 colonnes détectées, coupure à x={coupure:.0f}px")
                else:
                    print(f"  Page {num_page+1} : 1 colonne")

            lignes = reconstruire_lignes(words, coupure_x=coupure)
            toutes_lignes.extend(lignes)

    return toutes_lignes


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRACTION DEPUIS IMAGE
# ═══════════════════════════════════════════════════════════════════════════════

def ameliorer_image(img: Image.Image) -> Image.Image:
    from PIL import ImageEnhance, ImageFilter
    img = img.convert("L")
    img = ImageEnhance.Contrast(img).enhance(2.0)
    img = ImageEnhance.Sharpness(img).enhance(1.5)
    return img


def extraire_lignes_image(chemin: str) -> list[str]:
    """OCR amélioré sur image avec post-traitement des lignes."""
    img = Image.open(chemin)
    img = ameliorer_image(img)

    # Données brutes Tesseract avec positions
    data = pytesseract.image_to_data(img, lang="fra+eng",
                                     output_type=pytesseract.Output.DICT)

    # Reconstruire les mots avec positions
    words = []
    for i, text in enumerate(data["text"]):
        text = text.strip()
        if text and int(data["conf"][i]) > 30:  # confiance > 30%
            words.append({
                "text": text,
                "x0":   data["left"][i],
                "x1":   data["left"][i] + data["width"][i],
                "top":  data["top"][i],
            })

    if not words:
        return []

    # Largeur image
    largeur = img.width
    coupure = detecter_colonne_coupure(words, largeur)

    return reconstruire_lignes(words, coupure_x=coupure)


# ═══════════════════════════════════════════════════════════════════════════════
# FONCTION PRINCIPALE (utilisée par 1_annoter.py, 2_entrainer.py, 3_predire.py)
# ═══════════════════════════════════════════════════════════════════════════════

def extraire_lignes_intelligentes(chemin: str, debug: bool = False) -> list[str]:
    """
    Point d'entrée unique.
    Détecte le type de fichier et extrait les lignes intelligemment.
    """
    ext = Path(chemin).suffix.lower()

    if ext == ".pdf":
        return extraire_lignes_pdf(chemin, debug=debug)
    elif ext in [".jpg", ".jpeg", ".png", ".tiff", ".bmp", ".webp"]:
        return extraire_lignes_image(chemin)
    else:
        raise ValueError(f"Format non supporté : {ext}")


# ═══════════════════════════════════════════════════════════════════════════════
# TEST EN LIGNE DE COMMANDE
# ═══════════════════════════════════════════════════════════════════════════════

def main():
    if len(sys.argv) < 2:
        print("Usage : python correctif_lignes.py fichier.pdf")
        sys.exit(0)

    chemin = sys.argv[1]
    debug  = "--debug" in sys.argv

    print(f"\nExtraction intelligente : {Path(chemin).name}")
    print("─" * 55)

    lignes = extraire_lignes_intelligentes(chemin, debug=debug)

    print(f"{len(lignes)} lignes extraites :\n")
    for i, ligne in enumerate(lignes):
        print(f"  [{i+1:>2}] {ligne}")

    print(f"\n✅ Terminé — {len(lignes)} lignes propres")


if __name__ == "__main__":
    main()
