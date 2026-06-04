"""
Script d'entraînement du modèle NER spaCy pour l'extraction de factures.

Ce script :
1. Crée un pipeline NER spaCy vierge
2. L'entraîne sur les données annotées de factures (training_data.py)
3. Sauvegarde le modèle entraîné dans ./models/invoice_ner

Usage :
    python train_ner.py
"""

import spacy
from spacy.training import Example
from spacy.util import minibatch
import random
import warnings
import os
from training_data import TRAIN_DATA

# Les labels d'entités que notre modèle va apprendre
LABELS = [
    "FOURNISSEUR",
    "CLIENT", 
    "NUM_FACTURE",
    "DATE",
    "MONTANT_HT",
    "MONTANT_TVA",
    "MONTANT_TTC",
    "TVA_PERCENT",
    "DEVISE",
    "IBAN",
]

def train_model(output_dir="./models/invoice_ner", n_iter=50):
    """Entraîne un modèle NER spaCy sur les données de factures."""

    # 1. Créer un pipeline vierge avec le français comme langue de base
    nlp = spacy.blank("fr")
    print(f"✅ Pipeline spaCy créé (langue: {nlp.lang})")

    # 2. Ajouter le composant NER
    if "ner" not in nlp.pipe_names:
        ner = nlp.add_pipe("ner", last=True)
    else:
        ner = nlp.get_pipe("ner")

    # 3. Ajouter les labels d'entités
    for label in LABELS:
        ner.add_label(label)
    print(f"✅ {len(LABELS)} labels ajoutés : {', '.join(LABELS)}")

    # 4. Préparer les exemples d'entraînement
    examples = []
    for text, annotations in TRAIN_DATA:
        doc = nlp.make_doc(text)
        example = Example.from_dict(doc, annotations)
        examples.append(example)
    print(f"✅ {len(examples)} exemples d'entraînement préparés")

    # 5. Commencer l'entraînement
    nlp.initialize(lambda: examples)
    
    print(f"\n🚀 Début de l'entraînement ({n_iter} itérations)...")
    print("-" * 50)

    # Désactiver les avertissements pendant l'entraînement
    warnings.filterwarnings("ignore")

    best_loss = float('inf')
    
    for itn in range(n_iter):
        random.shuffle(examples)
        losses = {}
        
        # Mini-batch training
        batches = minibatch(examples, size=2)
        for batch in batches:
            nlp.update(batch, losses=losses, drop=0.35)
        
        current_loss = losses.get("ner", 0)
        
        # Afficher la progression tous les 10 itérations
        if (itn + 1) % 10 == 0 or itn == 0:
            print(f"  Itération {itn+1:3d}/{n_iter} — Loss: {current_loss:.4f}")
        
        if current_loss < best_loss:
            best_loss = current_loss

    print("-" * 50)
    print(f"✅ Entraînement terminé ! Meilleur loss: {best_loss:.4f}")

    # 6. Sauvegarder le modèle
    os.makedirs(output_dir, exist_ok=True)
    nlp.to_disk(output_dir)
    print(f"💾 Modèle sauvegardé dans: {output_dir}")

    # 7. Test rapide
    print("\n🧪 Test rapide du modèle entraîné :")
    print("-" * 50)
    test_text = (
        "Facture N° TEST-2025-999 Date: 20/04/2025 "
        "Émetteur: Société Example SA Tunis "
        "Client: Mon Client SARL "
        "Total HT: 3500.00 TND TVA 19%: 665.00 TND Total TTC: 4165.00 TND"
    )
    
    # Charger le modèle sauvegardé pour tester
    nlp_loaded = spacy.load(output_dir)
    doc = nlp_loaded(test_text)
    
    if doc.ents:
        for ent in doc.ents:
            print(f"  {ent.label_:15s} → {ent.text}")
    else:
        print("  ⚠️ Aucune entité détectée. Essayez avec plus de données d'entraînement.")

    print("\n✅ Modèle prêt à être utilisé par le micro-service FastAPI !")

if __name__ == "__main__":
    train_model()
