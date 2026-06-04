"""
PHASE 1 — Outil d'Annotation
=============================
Vous chargez vos vraies factures, le script extrait le texte
ligne par ligne, et vous étiquetez chaque ligne dans le terminal.

Étiquettes disponibles :
  O           = ligne ordinaire (rien d'important)
  FOURNISSEUR = nom de l'émetteur
  NUMERO      = numéro de facture
  DATE        = date d'émission
  TOTAL_HT    = montant hors taxe
  TVA         = montant TVA
  TOTAL_TTC   = montant total TTC
  DEVISE      = devise (DT, EUR, MAD...)

Usage :
  python 1_annoter.py facture1.pdf
  python 1_annoter.py dossier/factures/
"""

import json, sys, os
from pathlib import Path

try:
    import pdfplumber
    from pdf2image import convert_from_path
    import pytesseract
    from PIL import Image
except ImportError:
    print("Installez : pip install pdfplumber pdf2image pytesseract pillow")
    sys.exit(1)

DATASET_PATH = Path("data/dataset.json")
ETIQUETTES   = ["O", "FOURNISSEUR", "NUMERO", "DATE",
                 "TOTAL_HT", "TVA", "TOTAL_TTC", "DEVISE"]

C = {
    "reset": "\033[0m", "gras": "\033[1m",
    "vert": "\033[92m",  "jaune": "\033[93m",
    "bleu": "\033[94m",  "rouge": "\033[91m",
    "cyan": "\033[96m",
}

def c(t, col): return f"{C[col]}{t}{C['reset']}"


# ── Extraction de texte ────────────────────────────────────────────────────────

def lignes_depuis_pdf(chemin: str) -> list[str]:
    """Extrait les lignes de texte depuis un PDF (natif ou scanné)."""
    texte = ""
    with pdfplumber.open(chemin) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                texte += t + "\n"

    if len(texte.strip()) < 30:
        print(c("  → PDF scanné, OCR en cours...", "jaune"))
        images = convert_from_path(chemin, dpi=300)
        for img in images:
            texte += pytesseract.image_to_string(img, lang="fra+eng") + "\n"

    lignes = [l.strip() for l in texte.splitlines() if l.strip()]
    return lignes


def lignes_depuis_image(chemin: str) -> list[str]:
    """Extrait les lignes de texte depuis une image."""
    img = Image.open(chemin)
    texte = pytesseract.image_to_string(img, lang="fra+eng")
    return [l.strip() for l in texte.splitlines() if l.strip()]


def extraire_lignes(chemin: str) -> list[str]:
    ext = Path(chemin).suffix.lower()
    if ext == ".pdf":
        return lignes_depuis_pdf(chemin)
    elif ext in [".jpg", ".jpeg", ".png", ".tiff", ".bmp"]:
        return lignes_depuis_image(chemin)
    else:
        raise ValueError(f"Format non supporté : {ext}")


# ── Interface d'annotation ────────────────────────────────────────────────────

def afficher_menu():
    print(c("\nÉtiquettes disponibles :", "bleu"))
    for i, e in enumerate(ETIQUETTES):
        print(f"  {c(str(i), 'jaune')} = {e}")
    print(f"  {c('s', 'rouge')} = sauvegarder et quitter")
    print(f"  {c('p', 'cyan')} = passer ce document")


def annoter_document(chemin: str) -> dict | None:
    """Interface interactive : affiche chaque ligne, demande l'étiquette."""
    print(f"\n{'═'*60}")
    print(c(f"  Document : {Path(chemin).name}", "gras"))
    print('═'*60)

    try:
        lignes = extraire_lignes(chemin)
    except Exception as e:
        print(c(f"  Erreur extraction : {e}", "rouge"))
        return None

    if not lignes:
        print(c("  Aucune ligne extraite !", "rouge"))
        return None

    print(c(f"  {len(lignes)} lignes extraites.\n", "vert"))
    afficher_menu()

    annotations = []
    i = 0
    while i < len(lignes):
        ligne = lignes[i]
        print(f"\n  [{c(str(i+1), 'cyan')}/{len(lignes)}] {c(ligne, 'gras')}")
        rep = input(f"  Étiquette (0-{len(ETIQUETTES)-1} / s / p) : ").strip().lower()

        if rep == "s":
            break
        elif rep == "p":
            return None
        elif rep.isdigit() and 0 <= int(rep) < len(ETIQUETTES):
            etiquette = ETIQUETTES[int(rep)]
            annotations.append({"texte": ligne, "label": etiquette})
            couleur = "vert" if etiquette != "O" else "reset"
            print(c(f"  → {etiquette}", couleur))
            i += 1
        else:
            print(c("  Entrée invalide, recommencez.", "rouge"))

    if not annotations:
        return None

    return {
        "fichier": Path(chemin).name,
        "lignes": annotations
    }


# ── Gestion du dataset ────────────────────────────────────────────────────────

def charger_dataset() -> list:
    if DATASET_PATH.exists():
        with open(DATASET_PATH, encoding="utf-8") as f:
            return json.load(f)
    return []


def sauvegarder_dataset(dataset: list):
    DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(dataset, f, ensure_ascii=False, indent=2)
    print(c(f"\n  Sauvegardé : {DATASET_PATH} ({len(dataset)} documents)", "vert"))


def afficher_stats(dataset: list):
    if not dataset:
        print(c("  Dataset vide.", "jaune"))
        return
    total_lignes = sum(len(d["lignes"]) for d in dataset)
    stats = {}
    for doc in dataset:
        for ligne in doc["lignes"]:
            lbl = ligne["label"]
            stats[lbl] = stats.get(lbl, 0) + 1

    print(c(f"\n  Dataset : {len(dataset)} documents, {total_lignes} lignes annotées", "bleu"))
    for lbl, n in sorted(stats.items(), key=lambda x: -x[1]):
        barre = "█" * min(n, 30)
        print(f"  {lbl:<15} {barre} {n}")
    print()


# ── Point d'entrée ────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print("Usage :")
        print("  python 1_annoter.py facture.pdf")
        print("  python 1_annoter.py dossier/")
        print("  python 1_annoter.py --stats   ← voir l'état du dataset")
        sys.exit(0)

    dataset = charger_dataset()

    if sys.argv[1] == "--stats":
        afficher_stats(dataset)
        return

    cible = sys.argv[1]
    extensions = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".bmp"}

    if os.path.isdir(cible):
        fichiers = [
            str(f) for f in Path(cible).iterdir()
            if f.suffix.lower() in extensions
        ]
    elif os.path.isfile(cible):
        fichiers = [cible]
    else:
        print(c(f"Fichier/dossier introuvable : {cible}", "rouge"))
        sys.exit(1)

    deja_annotes = {d["fichier"] for d in dataset}
    nouveaux = [f for f in fichiers if Path(f).name not in deja_annotes]

    print(c(f"\n  {len(fichiers)} fichier(s) trouvé(s)", "bleu"))
    print(c(f"  {len(nouveaux)} non encore annotés", "vert"))
    afficher_stats(dataset)

    for chemin in nouveaux:
        resultat = annoter_document(chemin)
        if resultat:
            dataset.append(resultat)
            sauvegarder_dataset(dataset)
            print(c(f"  Document ajouté au dataset !", "vert"))

    print(c("\nAnnotation terminée !", "gras"))
    afficher_stats(dataset)


if __name__ == "__main__":
    main()
