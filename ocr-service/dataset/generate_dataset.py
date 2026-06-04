"""
Générateur de dataset d'entraînement pour le modèle CRF.
Crée des factures synthétiques annotées en format BIO.
"""
import re
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.ml.features import text2tokens

def tokenize(text: str):
    return re.findall(r"\w+|[^\w\s]", text)

def make_bio(tokens, entity_tokens, label):
    """Retourne les étiquettes BIO pour une liste de tokens."""
    tags = []
    i = 0
    entity = tokenize(" ".join(entity_tokens)) if isinstance(entity_tokens, list) else tokenize(entity_tokens)
    while i < len(tokens):
        if tokens[i:i+len(entity)] == entity:
            tags.append(f"B-{label}")
            for _ in range(1, len(entity)):
                tags.append(f"I-{label}")
            i += len(entity)
        else:
            tags.append("O")
            i += 1
    return tags

def merge_tags(*tag_lists):
    """Fusionne plusieurs listes de tags BIO (priorité au premier non-O)."""
    result = []
    for tags in zip(*tag_lists):
        chosen = "O"
        for t in tags:
            if t != "O":
                chosen = t
                break
        result.append(chosen)
    return result


def make_invoice_fr_1():
    text = """FACTURE
Numéro de facture : FA-2024-0042
Date de facturation : 15/03/2024
Vendeur : Mon Entreprise SARL
22 Avenue de la Liberté
75001 Paris
Facturé à : Jean-Pierre Durand
45 Rue du Commerce
69000 Lyon
Total HT : 1 500,00
TVA : 300,00
Total TTC : 1 800,00
Devise : EUR"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)

    def tag_entity(entity_str, label):
        entity_tokens = tokenize(entity_str)
        new_tags = make_bio(tokens, entity_tokens, label)
        return merge_tags(tags, new_tags)

    tags = tag_entity("FA-2024-0042", "NUM")
    tags = tag_entity("15/03/2024", "DATE")
    tags = tag_entity("Mon Entreprise SARL", "FOURNISSEUR")
    tags = tag_entity("Jean-Pierre Durand", "CLIENT")
    tags = tag_entity("1 500", "HT")
    tags = tag_entity("300", "TVA")
    tags = tag_entity("1 800", "TTC")
    tags = tag_entity("EUR", "DEVISE")
    return (text, tags)

def make_invoice_fr_2():
    text = """Facture N° 143
Date : 16/08/2021
Fournisseur : Tech Solutions SARL
Client : Michel Acheteur
Montant HT : 1 350,00 TND
Total TVA 20% : 270,00 TND
Net à payer : 1 620,00 TND"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("143", "NUM")
    tags = t("16/08/2021", "DATE")
    tags = t("Tech Solutions SARL", "FOURNISSEUR")
    tags = t("Michel Acheteur", "CLIENT")
    tags = t("1 350", "HT")
    tags = t("270", "TVA")
    tags = t("1 620", "TTC")
    tags = t("TND", "DEVISE")
    return (text, tags)

def make_invoice_en_1():
    text = """INVOICE
Invoice No: INV-2024-5001
Invoice Date: March 20, 2024
From: Acme Corp LLC
123 Business Ave, New York
Bill To: John Smith
456 Client St, Chicago
Subtotal: 2,500.00
VAT (20%): 500.00
Total Due: 3,000.00 USD"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("INV-2024-5001", "NUM")
    tags = t("March 20", "DATE")
    tags = t("Acme Corp LLC", "FOURNISSEUR")
    tags = t("John Smith", "CLIENT")
    tags = t("2,500", "HT")
    tags = t("500", "TVA")
    tags = t("3,000", "TTC")
    tags = t("USD", "DEVISE")
    return (text, tags)

def make_invoice_en_2():
    text = """Tax Invoice
Invoice Number: #F-2024-0012
Date: 2024-01-15
Vendor: Global Services Ltd
Customer: Alice Johnson
Net Amount: 850.00
Tax Amount (15%): 127.50
Amount Due: 977.50 GBP"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("F-2024-0012", "NUM")
    tags = t("2024-01-15", "DATE")
    tags = t("Global Services Ltd", "FOURNISSEUR")
    tags = t("Alice Johnson", "CLIENT")
    tags = t("850", "HT")
    tags = t("127", "TVA")
    tags = t("977", "TTC")
    tags = t("GBP", "DEVISE")
    return (text, tags)

def make_invoice_tn_1():
    text = """Facture Commerciale
Numéro : FC-2024-089
Date d'émission : 05/07/2024
Fournisseur : Société Tunisienne de Services SARL
Client : Entreprise Moderne
Montant Hors Taxe : 5 200,000 DT
TVA 19% : 988,000 DT
Montant Total TTC : 6 188,000 DT"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("FC-2024-089", "NUM")
    tags = t("05/07/2024", "DATE")
    tags = t("Société Tunisienne de Services SARL", "FOURNISSEUR")
    tags = t("Entreprise Moderne", "CLIENT")
    tags = t("5 200", "HT")
    tags = t("988", "TVA")
    tags = t("6 188", "TTC")
    tags = t("DT", "DEVISE")
    return (text, tags)

def make_invoice_minimal():
    """Facture sans labels — test extraction par structure."""
    text = """SARL Dupont & Associés
2024-003
12.04.2024
Prestation conseil juridique
HT 2000.00
TVA 400.00
TTC 2400.00
EUR"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("SARL Dupont", "FOURNISSEUR")
    tags = t("2024-003", "NUM")
    tags = t("12.04.2024", "DATE")
    tags = t("2000", "HT")
    tags = t("400", "TVA")
    tags = t("2400", "TTC")
    tags = t("EUR", "DEVISE")
    return (text, tags)

def make_invoice_tabular():
    """Facture en colonnes sans deux-points."""
    text = """Invoice Number Date Total
INV-001 2024-02-01 4500.00
Billed From Company ABC Inc
Billed To  Client XYZ Corp
Subtotal 4500.00
Tax 900.00
Grand Total 5400.00 EUR"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("INV-001", "NUM")
    tags = t("2024-02-01", "DATE")
    tags = t("Company ABC Inc", "FOURNISSEUR")
    tags = t("Client XYZ Corp", "CLIENT")
    tags = t("4500", "HT")
    tags = t("900", "TVA")
    tags = t("5400", "TTC")
    tags = t("EUR", "DEVISE")
    return (text, tags)

def make_invoice_morocco():
    text = """Facture
Réf : FAC/2024/00231
Date : 22/09/2024
Émis par : MAROC DIGITAL SARL
Adressé à : Hamid Benali
Montant HT : 8 700,00 MAD
TVA 20% : 1 740,00 MAD
Total TTC : 10 440,00 MAD"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("FAC/2024/00231", "NUM")
    tags = t("22/09/2024", "DATE")
    tags = t("MAROC DIGITAL SARL", "FOURNISSEUR")
    tags = t("Hamid Benali", "CLIENT")
    tags = t("8 700", "HT")
    tags = t("1 740", "TVA")
    tags = t("10 440", "TTC")
    tags = t("MAD", "DEVISE")
    return (text, tags)

def make_invoice_fr_3():
    text = """Devis / Facture Pro Forma
Référence : DEV-2024-007
Date d'émission : 30.11.2024
Prestataire : Cabinet Conseil Martin SAS
Destinataire : Mme Sophie Laurent
Montant hors taxes : 3 200,00 €
Taxe sur valeur ajoutée : 640,00 €
Net à régler : 3 840,00 €"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("DEV-2024-007", "NUM")
    tags = t("30.11.2024", "DATE")
    tags = t("Cabinet Conseil Martin SAS", "FOURNISSEUR")
    tags = t("Mme Sophie Laurent", "CLIENT")
    tags = t("3 200", "HT")
    tags = t("640", "TVA")
    tags = t("3 840", "TTC")
    tags = t("€", "DEVISE")
    return (text, tags)

def make_invoice_en_3():
    text = """COMMERCIAL INVOICE
Order Number: ORD-98765
Issue Date: July 5, 2024
Seller: TechBridge Solutions Inc
Buyer: DataCorp Industries
Base Amount: $12,500.00
Sales Tax (8%): $1,000.00
Total Amount Due: $13,500.00"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("ORD-98765", "NUM")
    tags = t("July 5", "DATE")
    tags = t("TechBridge Solutions Inc", "FOURNISSEUR")
    tags = t("DataCorp Industries", "CLIENT")
    tags = t("12,500", "HT")
    tags = t("1,000", "TVA")
    tags = t("13,500", "TTC")
    tags = t("$", "DEVISE")
    return (text, tags)

def make_invoice_tn_2():
    text = """Facture N° 2024/F/145
Sfax, le 10 Janvier 2024
Fournisseur :
SARL INFORMATICA
Route de Tunis, Sfax
Matricule Fiscal : 123456789
Client : Société Générale de Commerce
Montant HT : 2 800,000 TND
TVA 19% : 532,000 TND
Total TTC : 3 332,000 TND"""
    tokens = tokenize(text)
    tags = ["O"] * len(tokens)
    def t(val, label):
        return merge_tags(tags, make_bio(tokens, tokenize(val), label))
    tags = t("2024/F/145", "NUM")
    tags = t("10 Janvier 2024", "DATE")
    tags = t("SARL INFORMATICA", "FOURNISSEUR")
    tags = t("Société Générale de Commerce", "CLIENT")
    tags = t("2 800", "HT")
    tags = t("532", "TVA")
    tags = t("3 332", "TTC")
    tags = t("TND", "DEVISE")
    return (text, tags)

DATASET = [
    make_invoice_fr_1(),
    make_invoice_fr_2(),
    make_invoice_fr_3(),
    make_invoice_en_1(),
    make_invoice_en_2(),
    make_invoice_en_3(),
    make_invoice_tn_1(),
    make_invoice_tn_2(),
    make_invoice_minimal(),
    make_invoice_tabular(),
    make_invoice_morocco(),
]

def validate_dataset(dataset):
    """Vérifie que chaque texte a le bon nombre de labels."""
    errors = 0
    for i, (text, tags) in enumerate(dataset):
        tokens = tokenize(text)
        if len(tokens) != len(tags):
            print(f"[ERROR] Sample {i}: {len(tokens)} tokens vs {len(tags)} tags")
            print(f"  Tokens: {tokens[:10]}...")
            errors += 1
        else:
            labeled = [(tok, tag) for tok, tag in zip(tokens, tags) if tag != "O"]
            print(f"[OK] Sample {i}: {len(tokens)} tokens, {len(labeled)} labeled")
    return errors == 0

if __name__ == "__main__":
    print("Validating dataset...")
    if validate_dataset(DATASET):
        print(f"\nDataset OK: {len(DATASET)} samples ready for training.")
    else:
        print("\nFix errors above before training!")
