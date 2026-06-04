import json, pickle, sys, re
from pathlib import Path
try:
    import pdfplumber
except ImportError: sys.exit(1)

MODELE_PATH = Path("modeles/modele_facture.pkl")

def features_ligne(lignes, i):
    ligne = lignes[i]
    ll = ligne.lower()
    return {"contient_chiffres": bool(re.search(r"\d", ligne)), "mot_facture": "facture" in ll, "position_debut": i < 5}

def predire(chemin):
    with open(MODELE_PATH, "rb") as f: crf = pickle.load(f)
    with pdfplumber.open(chemin) as pdf:
        lignes = [l.strip() for p in pdf.pages for l in (p.extract_text() or "").splitlines() if l.strip()]
    feats = [features_ligne(lignes, i) for i in range(len(lignes))]
    preds = crf.predict([feats])[0]
    for l, p in zip(lignes, preds): 
        if p != "O": print(f"{p}: {l}")

if __name__ == "__main__":
    if len(sys.argv) > 1: predire(sys.argv[1])
