"""
Données d'entraînement pour le modèle NER spaCy.
Chaque entrée contient :
  - Le texte brut d'une facture (simulant la sortie de Tesseract)
  - Les entités annotées (start, end, label)

Labels utilisés :
  - FOURNISSEUR : Nom de l'émetteur de la facture
  - CLIENT : Nom du destinataire
  - NUM_FACTURE : Numéro de la facture
  - DATE : Date d'émission ou d'échéance
  - MONTANT_HT : Montant hors taxes
  - MONTANT_TVA : Montant de la TVA
  - MONTANT_TTC : Montant toutes taxes comprises
  - TVA_PERCENT : Taux de TVA en pourcentage
  - DEVISE : Devise utilisée (EUR, TND, USD...)
  - IBAN : Numéro IBAN ou RIB
"""

TRAIN_DATA = [
    # --- Facture 1 ---
    (
        "Facture N° FAC-2025-001 Date: 15/01/2025 Échéance: 15/02/2025 "
        "Émetteur: Global Corp SA 12 Rue de la Paix Paris 75001 "
        "Client: Comptabli SARL 45 Avenue Habib Bourguiba Tunis 1000 "
        "Prestation de développement web Quantité: 1 Prix unitaire: 5000.00 EUR "
        "Sous-total HT: 5000.00 EUR TVA 19%: 950.00 EUR Total TTC: 5950.00 EUR "
        "Paiement par virement bancaire IBAN: FR76 3000 6000 0112 3456 7890 189",
        {
            "entities": [
                (12, 24, "NUM_FACTURE"),
                (31, 41, "DATE"),
                (53, 63, "DATE"),
                (74, 88, "FOURNISSEUR"),
                (120, 135, "CLIENT"),
                (219, 226, "MONTANT_HT"),
                (232, 235, "DEVISE"),
                (240, 242, "TVA_PERCENT"),
                (244, 250, "MONTANT_TVA"),
                (255, 258, "DEVISE"),
                (270, 277, "MONTANT_TTC"),
                (278, 281, "DEVISE"),
                (320, 355, "IBAN"),
            ]
        }
    ),
    # --- Facture 2 ---
    (
        "FACTURE Numéro: INV-2025-042 Du 22/03/2025 "
        "Société ABC Services 78 Boulevard Haussmann 75008 Paris France "
        "Destinataire: Tech Solutions Tunisie SARL Route de la Marsa Tunis "
        "Consultation informatique 3 jours à 800.00 TND "
        "Total Hors Taxes: 2400.00 TND Taxe TVA 19%: 456.00 TND "
        "Montant Total TTC: 2856.00 TND "
        "Règlement sous 30 jours par chèque",
        {
            "entities": [
                (17, 29, "NUM_FACTURE"),
                (33, 43, "DATE"),
                (44, 62, "FOURNISSEUR"),
                (107, 136, "CLIENT"),
                (206, 213, "MONTANT_HT"),
                (214, 217, "DEVISE"),
                (227, 229, "TVA_PERCENT"),
                (231, 237, "MONTANT_TVA"),
                (238, 241, "DEVISE"),
                (261, 268, "MONTANT_TTC"),
                (269, 272, "DEVISE"),
            ]
        }
    ),
    # --- Facture 3 ---
    (
        "Facture de vente N° F-20250315 Établie le 15 mars 2025 "
        "Par: Menuiserie Bois & Fils SARL au capital de 50000 TND "
        "Adresse: 23 Rue Ibn Khaldoun Sfax Tunisie "
        "À l'attention de: Cabinet Comptable El Amri "
        "4 portes en bois massif 450.00 TND l'unité "
        "2 fenêtres double vitrage 320.00 TND l'unité "
        "Total HT: 2440.00 TND TVA (19%): 463.60 TND Total TTC: 2903.60 TND "
        "RIB: 07 028 0300 0000 2345 67",
        {
            "entities": [
                (22, 34, "NUM_FACTURE"),
                (48, 61, "DATE"),
                (67, 94, "FOURNISSEUR"),
                (162, 189, "CLIENT"),
                (299, 306, "MONTANT_HT"),
                (307, 310, "DEVISE"),
                (316, 318, "TVA_PERCENT"),
                (321, 327, "MONTANT_TVA"),
                (328, 331, "DEVISE"),
                (343, 350, "MONTANT_TTC"),
                (351, 354, "DEVISE"),
                (361, 386, "IBAN"),
            ]
        }
    ),
    # --- Facture 4 ---
    (
        "FACTURE PROFORMA Référence: PF-2025-099 Date d'émission: 01/04/2025 "
        "Entreprise: Solutions Digitales Maghreb SA "
        "147 Avenue de la Liberté Tunis 1002 Tunisie "
        "Client: Banque Nationale Agricole Direction Générale "
        "Développement application mobile - phase 1 forfait 15000.00 TND "
        "Intégration API bancaire forfait 8000.00 TND "
        "Formation utilisateurs 5 jours 500.00 TND/jour 2500.00 TND "
        "Sous-total HT: 25500.00 TND TVA 19%: 4845.00 TND "
        "Net à payer TTC: 30345.00 TND "
        "Conditions: 30% à la commande solde à la livraison",
        {
            "entities": [
                (27, 38, "NUM_FACTURE"),
                (55, 65, "DATE"),
                (79, 113, "FOURNISSEUR"),
                (165, 193, "CLIENT"),
                (351, 359, "MONTANT_HT"),
                (360, 363, "DEVISE"),
                (368, 370, "TVA_PERCENT"),
                (372, 379, "MONTANT_TVA"),
                (380, 383, "DEVISE"),
                (401, 409, "MONTANT_TTC"),
                (410, 413, "DEVISE"),
            ]
        }
    ),
    # --- Facture 5 ---
    (
        "Facture N°: 2025/F/0078 Date: 10/02/2025 "
        "De: Restaurant Le Jasmin SARL Rue de Marseille Tunis "
        "Pour: Société Comptabli 30 couverts repas affaires "
        "30 repas x 35.00 TND = 1050.00 TND "
        "Boissons forfait = 150.00 TND "
        "Total HT: 1200.00 TND TVA 7%: 84.00 TND Total TTC: 1284.00 TND "
        "Payé en espèces Merci de votre visite",
        {
            "entities": [
                (13, 25, "NUM_FACTURE"),
                (32, 42, "DATE"),
                (47, 72, "FOURNISSEUR"),
                (99, 117, "CLIENT"),
                (167, 174, "MONTANT_HT"),
                (175, 178, "DEVISE"),
                (183, 184, "TVA_PERCENT"),
                (187, 192, "MONTANT_TVA"),
                (193, 196, "DEVISE"),
                (208, 215, "MONTANT_TTC"),
                (216, 219, "DEVISE"),
            ]
        }
    ),
    # --- Facture 6 ---
    (
        "INVOICE No: EXP-2025-FR-001 Date: 2025-03-20 Due: 2025-04-20 "
        "From: TechVision Europe SAS 5 Place de la Bourse Lyon 69002 France "
        "Bill To: Comptabli Platform SARL Avenue Mohamed V Casablanca Maroc "
        "Cloud hosting annual subscription 1 12000.00 EUR "
        "Premium support package 1 3600.00 EUR "
        "Subtotal: 15600.00 EUR VAT 20%: 3120.00 EUR "
        "Grand Total: 18720.00 EUR "
        "Wire transfer to IBAN: DE89 3704 0044 0532 0130 00",
        {
            "entities": [
                (12, 28, "NUM_FACTURE"),
                (35, 45, "DATE"),
                (51, 61, "DATE"),
                (68, 90, "FOURNISSEUR"),
                (133, 157, "CLIENT"),
                (260, 268, "MONTANT_HT"),
                (269, 272, "DEVISE"),
                (277, 279, "TVA_PERCENT"),
                (281, 288, "MONTANT_TVA"),
                (289, 292, "DEVISE"),
                (307, 315, "MONTANT_TTC"),
                (316, 319, "DEVISE"),
                (343, 374, "IBAN"),
            ]
        }
    ),
    # --- Facture 7 ---
    (
        "Facture N° FACT/2025/03/112 en date du 28 mars 2025 "
        "émise par: Imprimerie Centrale de Tunis "
        "au profit de: Cabinet Juridique Ben Amor "
        "500 cartes de visite recto-verso couleur 0.80 TND pièce 400.00 TND "
        "200 enveloppes personnalisées 0.50 TND pièce 100.00 TND "
        "1000 flyers A5 couleur 0.30 TND pièce 300.00 TND "
        "Montant HT: 800.00 TND TVA (19%): 152.00 TND "
        "Total à payer: 952.00 TND",
        {
            "entities": [
                (12, 28, "NUM_FACTURE"),
                (41, 53, "DATE"),
                (65, 93, "FOURNISSEUR"),
                (110, 139, "CLIENT"),
                (308, 314, "MONTANT_HT"),
                (315, 318, "DEVISE"),
                (324, 326, "TVA_PERCENT"),
                (329, 335, "MONTANT_TVA"),
                (336, 339, "DEVISE"),
                (356, 362, "MONTANT_TTC"),
                (363, 366, "DEVISE"),
            ]
        }
    ),
    # --- Facture 8 ---
    (
        "Note d'honoraires N° H-2025-0044 Date: 05/04/2025 "
        "Expert Comptable: Mme Fatma Trabelsi Ordre des Experts Comptables de Tunisie "
        "Client: Startup InnoTech SARL Technopole El Ghazala Ariana "
        "Mission d'audit annuel des comptes exercice 2024 forfait 4500.00 TND "
        "Assistance déclarations fiscales 10 heures 200.00 TND/h 2000.00 TND "
        "Total honoraires HT: 6500.00 TND Timbre fiscal: 1.00 TND "
        "TVA 19%: 1235.00 TND Total TTC: 7736.00 TND",
        {
            "entities": [
                (22, 33, "NUM_FACTURE"),
                (40, 50, "DATE"),
                (72, 92, "FOURNISSEUR"),
                (139, 160, "CLIENT"),
                (313, 320, "MONTANT_HT"),
                (321, 324, "DEVISE"),
                (348, 350, "TVA_PERCENT"),
                (352, 359, "MONTANT_TVA"),
                (360, 363, "DEVISE"),
                (375, 382, "MONTANT_TTC"),
                (383, 386, "DEVISE"),
            ]
        }
    ),
]
