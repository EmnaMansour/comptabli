"""
Script complet d'entraînement du modèle CRF pour l'extraction de factures.
Utilise le dataset synthétique et sauvegarde le modèle.
"""
import os
import sys
import pickle
import sklearn_crfsuite
from sklearn_crfsuite import metrics

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ml.features import text2features, text2tokens
from dataset.generate_dataset import DATASET

MODEL_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../modeles")
os.makedirs(MODEL_DIR, exist_ok=True)
MODEL_PATH = os.path.join(MODEL_DIR, "crf_invoice_model.pkl")


def prepare_training_data(dataset):
    """
    Convertit le dataset brut en features CRF.
    Chaque échantillon est (texte, [labels_par_token]).
    """
    X, y = [], []
    for text, labels in dataset:
        tokens = text2tokens(text)
        if len(tokens) != len(labels):
            print(f"[SKIP] Token/label mismatch: {len(tokens)} vs {len(labels)}")
            continue
        features = text2features(text)
        X.append(features)
        y.append(labels)
    print(f"[INFO] Prepared {len(X)} training samples")
    return X, y


def train_crf_model(dataset):
    print("=" * 60)
    print("  Entrainement du modele CRF Factures")
    print("=" * 60)

    X_train, y_train = prepare_training_data(dataset)

    crf = sklearn_crfsuite.CRF(
        algorithm='lbfgs',
        c1=0.05,   # L1 regularization (faible pour éviter under-fitting)
        c2=0.05,   # L2 regularization
        max_iterations=200,
        all_possible_transitions=True
    )

    print("[INFO] Training...")
    crf.fit(X_train, y_train)

    # Évaluation sur les données d'entraînement
    y_pred = crf.predict(X_train)
    labels = list(crf.classes_)
    labels = [l for l in labels if l != 'O']

    print("\n--- Rapport d'evaluation (train) ---")
    try:
        print(metrics.flat_classification_report(
            y_train, y_pred,
            labels=labels,
            digits=3
        ))
    except TypeError:
        # Fallback for sklearn version compatibility
        from sklearn.metrics import classification_report
        y_flat_true = [tag for seq in y_train for tag in seq]
        y_flat_pred = [tag for seq in y_pred for tag in seq]
        print(classification_report(y_flat_true, y_flat_pred, labels=labels, digits=3))

    # Sauvegarde du modèle
    with open(MODEL_PATH, "wb") as f:
        pickle.dump(crf, f)

    print(f"\n[OK] Modele sauvegarde : {MODEL_PATH}")
    return crf


def test_model(crf):
    """Test rapide sur un exemple non vu pendant l'entraînement."""
    test_text = """INVOICE #2024-TEST-99
Date: 2024-06-01
From: Test Company SAS
To: Client Industries Ltd
Subtotal: 1000.00
VAT 20%: 200.00
Total Due: 1200.00 EUR"""

    tokens = text2tokens(test_text)
    features = [text2features(test_text)]
    predictions = crf.predict(features)[0]
    marginals = crf.predict_marginals(features)[0]

    print("\n--- Test sur exemple non vu ---")
    print(f"{'Token':<20} {'Prediction':<20} {'Conf'}")
    print("-" * 55)
    for token, label, probs in zip(tokens, predictions, marginals):
        if label != 'O':
            conf = probs.get(label, 0)
            print(f"{token:<20} {label:<20} {conf:.3f}")


if __name__ == "__main__":
    crf = train_crf_model(DATASET)
    test_model(crf)
    print("\n[DONE] Le modele CRF est pret ! Relancez le service OCR.")
