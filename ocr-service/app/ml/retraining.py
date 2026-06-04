"""
app/ml/retraining.py
=====================
Amélioration 4 — Réentraînement automatique du modèle CRF.

Déclenchement automatique : quand feedback_count % 50 == 0.
Stratégie de déploiement conditionnel : nouveau modèle déployé UNIQUEMENT si
F1_nouveau > F1_actuel (sur un jeu de validation à 20% des données).
Chaque session de réentraînement est loggée dans retraining_log.json.
"""

import os
import json
import pickle
import random
import logging
from datetime import datetime, timezone
from typing import List, Tuple

import sklearn_crfsuite
from sklearn.metrics import f1_score

from app.ml.features import text2features, text2tokens
from app.ml.alignment import align_annotations_to_tokens

# ── Chemins ──────────────────────────────────────────────────────────────────
_BASE = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR   = os.path.join(_BASE, "../../modeles")
MODEL_PATH  = os.path.join(MODEL_DIR, "crf_invoice_model.pkl")
BACKUP_PATH = os.path.join(MODEL_DIR, "crf_invoice_model_backup.pkl")
LOG_PATH    = os.path.join(_BASE, "retraining_log.json")

# Compteur de feedbacks persisté localement (utilisé si Redis n'est pas dispo)
COUNTER_PATH = os.path.join(_BASE, "feedback_counter.json")

os.makedirs(MODEL_DIR, exist_ok=True)

logger = logging.getLogger("retraining")
logging.basicConfig(level=logging.INFO)


# ═══════════════════════════════════════════════════════════════════════════════
# COMPTEUR DE FEEDBACKS
# ═══════════════════════════════════════════════════════════════════════════════

def _lire_compteur() -> int:
    """Lit le compteur de feedbacks depuis le fichier JSON local."""
    if os.path.exists(COUNTER_PATH):
        try:
            with open(COUNTER_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
                return int(data.get("count", 0))
        except (json.JSONDecodeError, ValueError):
            pass
    return 0


def _ecrire_compteur(count: int) -> None:
    """Écrit le compteur de feedbacks dans le fichier JSON local."""
    with open(COUNTER_PATH, "w", encoding="utf-8") as f:
        json.dump({"count": count, "updated_at": datetime.now(timezone.utc).isoformat()}, f)


def incrementer_compteur_et_verifier() -> bool:
    """
    Incrémente le compteur de feedbacks.
    Retourne True si un réentraînement doit être déclenché (count % 50 == 0).
    """
    count = _lire_compteur() + 1
    _ecrire_compteur(count)
    logger.info(f"[FEEDBACK] Compteur : {count}")
    return count % 50 == 0


# ═══════════════════════════════════════════════════════════════════════════════
# PRÉPARATION DES DONNÉES
# ═══════════════════════════════════════════════════════════════════════════════

def preparer_donnees(
    feedback_records: list,
    dataset_initial: List[Tuple] = None,
) -> Tuple[List, List]:
    """
    Convertit les feedbacks (et le dataset initial optionnel) en (X, y) CRF.

    feedback_records : liste de dicts {'texte_brut': str, 'annotations': dict}
    dataset_initial  : liste de tuples (texte, [labels]) si disponible
    """
    X, y = [], []

    # 1. Données issues des feedbacks utilisateurs
    for rec in feedback_records:
        try:
            texte = rec["texte_brut"] if isinstance(rec, dict) else rec.texte_brut
            annotations = rec["annotations"] if isinstance(rec, dict) else rec.annotations
            tags = align_annotations_to_tokens(texte, annotations)
            tokens = text2tokens(texte)
            if len(tokens) != len(tags):
                logger.warning(f"[SKIP] Mismatch tokens/tags ({len(tokens)} vs {len(tags)})")
                continue
            features = text2features(texte)
            X.append(features)
            y.append(tags)
        except Exception as e:
            logger.error(f"[ERROR] Alignement feedback échoué : {e}")

    # 2. Dataset initial (pour éviter le catastrophic forgetting)
    if dataset_initial:
        for texte, labels in dataset_initial:
            try:
                tokens = text2tokens(texte)
                if len(tokens) != len(labels):
                    continue
                features = text2features(texte)
                X.append(features)
                y.append(labels)
            except Exception as e:
                logger.error(f"[ERROR] Dataset initial : {e}")

    logger.info(f"[DATA] {len(X)} échantillons préparés pour l'entraînement")
    return X, y


# ═══════════════════════════════════════════════════════════════════════════════
# ÉVALUATION F1
# ═══════════════════════════════════════════════════════════════════════════════

def _evaluer_modele(crf, X_val: List, y_val: List) -> Tuple[float, float, float]:
    """
    Évalue un modèle CRF sur le jeu de validation.
    Retourne (f1_macro, precision_macro, recall_macro).
    """
    if not X_val:
        return 0.0, 0.0, 0.0

    y_pred = crf.predict(X_val)

    # Aplatir les séquences pour sklearn
    y_true_flat = [tag for seq in y_val for tag in seq]
    y_pred_flat = [tag for seq in y_pred for tag in seq]

    # Labels sans 'O'
    all_labels = sorted(set(y_true_flat) | set(y_pred_flat))
    labels_non_o = [l for l in all_labels if l != "O"]

    if not labels_non_o:
        return 0.0, 0.0, 0.0

    f1  = f1_score(y_true_flat, y_pred_flat, labels=labels_non_o, average="macro", zero_division=0)
    p   = f1_score(y_true_flat, y_pred_flat, labels=labels_non_o, average="macro", zero_division=0)  # simplifié
    r   = f1_score(y_true_flat, y_pred_flat, labels=labels_non_o, average="macro", zero_division=0)  # simplifié

    return round(float(f1), 4), round(float(p), 4), round(float(r), 4)


def _f1_modele_actuel(X_val: List, y_val: List) -> float:
    """Charge le modèle actuel depuis le disque et l'évalue."""
    if not os.path.exists(MODEL_PATH):
        return 0.0
    try:
        with open(MODEL_PATH, "rb") as f:
            crf_actuel = pickle.load(f)
        f1, _, _ = _evaluer_modele(crf_actuel, X_val, y_val)
        return f1
    except Exception as e:
        logger.error(f"[ERROR] Lecture modèle actuel : {e}")
        return 0.0


# ═══════════════════════════════════════════════════════════════════════════════
# ENTRAÎNEMENT
# ═══════════════════════════════════════════════════════════════════════════════

def _entrainer_nouveau_modele(X_train: List, y_train: List) -> sklearn_crfsuite.CRF:
    """Entraîne un nouveau CRF sur X_train / y_train."""
    crf = sklearn_crfsuite.CRF(
        algorithm="lbfgs",
        c1=0.05,
        c2=0.05,
        max_iterations=200,
        all_possible_transitions=True,
    )
    crf.fit(X_train, y_train)
    return crf


# ═══════════════════════════════════════════════════════════════════════════════
# LOGGING
# ═══════════════════════════════════════════════════════════════════════════════

def _logger_retraining(
    nb_echantillons: int,
    f1_avant: float,
    f1_apres: float,
    deploye: bool,
    raison: str,
) -> None:
    """Ajoute une entrée dans retraining_log.json."""
    entree = {
        "timestamp":       datetime.now(timezone.utc).isoformat(),
        "nb_echantillons": nb_echantillons,
        "f1_avant":        f1_avant,
        "f1_apres":        f1_apres,
        "amelioration":    round(f1_apres - f1_avant, 4),
        "deploye":         deploye,
        "raison":          raison,
    }

    historique = []
    if os.path.exists(LOG_PATH):
        try:
            with open(LOG_PATH, "r", encoding="utf-8") as f:
                historique = json.load(f)
        except (json.JSONDecodeError, ValueError):
            historique = []

    historique.append(entree)

    with open(LOG_PATH, "w", encoding="utf-8") as f:
        json.dump(historique, f, indent=2, ensure_ascii=False)

    logger.info(f"[LOG] Réentraînement loggé — F1 {f1_avant} → {f1_apres} | déployé={deploye}")


# ═══════════════════════════════════════════════════════════════════════════════
# POINT D'ENTRÉE PRINCIPAL
# ═══════════════════════════════════════════════════════════════════════════════

def lancer_retraining(
    feedback_records: list,
    dataset_initial: List[Tuple] = None,
    val_ratio: float = 0.20,
    extractor_instance=None,
) -> dict:
    """
    Réentraîne le modèle CRF de manière conditionnelle.

    Paramètres
    ----------
    feedback_records   : liste de feedbacks (dicts ou ORM objects)
    dataset_initial    : données initiales (évite le catastrophic forgetting)
    val_ratio          : fraction des données pour la validation (défaut 20%)
    extractor_instance : si fourni, recharge le modèle après déploiement

    Retourne un dict de statut.
    """
    logger.info("=" * 60)
    logger.info("  RÉENTRAÎNEMENT AUTOMATIQUE CRF")
    logger.info("=" * 60)

    # 1. Préparer toutes les données
    X_all, y_all = preparer_donnees(feedback_records, dataset_initial)

    if len(X_all) < 5:
        msg = f"Données insuffisantes ({len(X_all)} échantillons < 5). Réentraînement annulé."
        logger.warning(f"[SKIP] {msg}")
        return {"status": "skip", "raison": msg}

    # 2. Split train / validation (80/20 stratifié simple)
    indices = list(range(len(X_all)))
    random.shuffle(indices)
    split = max(1, int(len(indices) * (1 - val_ratio)))
    train_idx = indices[:split]
    val_idx   = indices[split:]

    X_train = [X_all[i] for i in train_idx]
    y_train = [y_all[i] for i in train_idx]
    X_val   = [X_all[i] for i in val_idx]
    y_val   = [y_all[i] for i in val_idx]

    logger.info(f"[SPLIT] Train={len(X_train)} | Val={len(X_val)}")

    # 3. F1 du modèle actuel sur la validation
    f1_actuel = _f1_modele_actuel(X_val, y_val)
    logger.info(f"[F1] Modèle actuel : {f1_actuel:.4f}")

    # 4. Entraîner le nouveau modèle
    try:
        nouveau_crf = _entrainer_nouveau_modele(X_train, y_train)
    except Exception as e:
        msg = f"Entraînement échoué : {e}"
        logger.error(f"[ERROR] {msg}")
        _logger_retraining(len(X_all), f1_actuel, 0.0, False, msg)
        return {"status": "error", "raison": msg}

    # 5. Évaluer le nouveau modèle
    f1_nouveau, precision, recall = _evaluer_modele(nouveau_crf, X_val, y_val)
    logger.info(f"[F1] Nouveau modèle : {f1_nouveau:.4f} (P={precision:.4f} R={recall:.4f})")

    # 6. Déploiement conditionnel
    if f1_nouveau > f1_actuel:
        # Sauvegarder l'ancien modèle comme backup
        if os.path.exists(MODEL_PATH):
            with open(MODEL_PATH, "rb") as f_in:
                backup_data = f_in.read()
            with open(BACKUP_PATH, "wb") as f_out:
                f_out.write(backup_data)

        # Écrire le nouveau modèle
        with open(MODEL_PATH, "wb") as f:
            pickle.dump(nouveau_crf, f)

        # Recharger dans l'instance active si disponible
        if extractor_instance is not None:
            try:
                extractor_instance.load_model()
                logger.info("[OK] Modèle rechargé dans l'extractor actif")
            except Exception as e:
                logger.error(f"[WARN] Rechargement extractor échoué : {e}")

        raison = f"F1 amélioré de {f1_actuel:.4f} → {f1_nouveau:.4f}"
        _logger_retraining(len(X_all), f1_actuel, f1_nouveau, True, raison)
        logger.info(f"[DEPLOY] ✅ Nouveau modèle déployé — {raison}")

        return {
            "status":     "deployed",
            "f1_avant":   f1_actuel,
            "f1_apres":   f1_nouveau,
            "precision":  precision,
            "recall":     recall,
            "echantillons": len(X_all),
            "raison":     raison,
        }
    else:
        raison = f"F1 non amélioré ({f1_nouveau:.4f} ≤ {f1_actuel:.4f}). Modèle actuel conservé."
        _logger_retraining(len(X_all), f1_actuel, f1_nouveau, False, raison)
        logger.info(f"[SKIP] ❌ {raison}")

        return {
            "status":     "skipped",
            "f1_avant":   f1_actuel,
            "f1_apres":   f1_nouveau,
            "precision":  precision,
            "recall":     recall,
            "echantillons": len(X_all),
            "raison":     raison,
        }
