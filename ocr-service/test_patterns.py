import sys
import os

# Add current directory to path to import main
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from main import extraire_avec_regex

factures = {
    "FR": """Facture
Vendeur Mon Entreprise
22, Avenue Voltaire
13000 Marseille

Client Michel Acheteur
31, rue de la Foret
13100 Aix-en-Provence

Date de facturation Numero de facture Echeance Paiement Reference
2.8.2021 143 16.8.2021 30 jours 1438

Description Quantite Unite Prix unitaire HT TVA Total TVA Total TTC
Main-d'oeuvre 5 h 60,00 20 % 60,00 360,00
Produit 10 pcs 105,00 20 % 210,00 1 250,00

Total HT 1 350,00
Total TVA 270,00
Total TTC 1 620,00""",

    "EN": """INVOICE
Vendor Global Tech LLC
123 Tech Park
San Francisco, CA 94105

Bill To John Doe
456 Main St
New York, NY 10001

Invoice Date: 2024-05-14
Invoice No: INV-2024-001

Subtotal $ 1,500.00
Tax (10%) $ 150.00
Total Amount $ 1,650.00""",

    "ES": """FACTURA
Proveedor Servicios Rápidos S.L.
Calle del Sol, 12
28001 Madrid

Cliente Juan Pérez
Avenida Central, 34
08001 Barcelona

Fecha: 14/05/2024
Factura N°: F-0042

Base Imponible € 1.000,00
IVA (21%) € 210,00
Importe Total € 1.210,00"""
}

for langue, texte in factures.items():
    print("=" * 60)
    print(f"TEST EXTRACTION - FACTURE {langue}")
    print("=" * 60)
    resultats = extraire_avec_regex(texte)
    for cle, valeur in resultats.items():
        if cle != "identifiants":
            print(f"  {cle:<15}: {valeur if valeur else 'NON TROUVE'}")
    print()
