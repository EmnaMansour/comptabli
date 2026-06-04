import json, re, pickle
from pathlib import Path
from collections import Counter
try:
    import sklearn_crfsuite
    from sklearn_crfsuite import metrics
    from sklearn.model_selection import train_test_split
except ImportError:
    print("Installez : pip install sklearn-crfsuite scikit-learn")
    import sys; sys.exit(1)

DATASET_PATH = Path("data/dataset.json")
MODELE_PATH  = Path("modeles/modele_facture.pkl")

def features_ligne(lignes: list[str], i: int) -> dict:
    ligne = lignes[i]
    ll = ligne.lower()
    feats = {
        "contient_chiffres": bool(re.search(r"\d", ligne)),
        "ratio_chiffres": sum(c.isdigit() for c in ligne) / max(len(ligne), 1),
        "mot_facture": any(m in ll for m in ["facture", "invoice"]),
        "mot_total": any(m in ll for m in ["total", "montant"]),
        "pattern_date": bool(re.search(r"\d{1,2}[/\-\.]\d{1,2}[/\-\.]\d{2,4}", ligne)),
        "position_debut": i < 5
    }
    return feats

def entrainer():
    if not DATASET_PATH.exists(): return
    with open(DATASET_PATH, encoding="utf-8") as f: dataset = json.load(f)
    X, y = [], []
    for doc in dataset:
        lignes = [item["texte"] for item in doc["lignes"]]
        X.append([features_ligne(lignes, i) for i in range(len(lignes))])
        y.append([item["label"] for item in doc["lignes"]])
    crf = sklearn_crfsuite.CRF(algorithm="lbfgs", c1=0.1, c2=0.1, max_iterations=100)
    crf.fit(X, y)
    MODELE_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(MODELE_PATH, "wb") as f: pickle.dump(crf, f)
    print(f"Modèle sauvegardé : {MODELE_PATH}")

if __name__ == "__main__":
    entrainer()
