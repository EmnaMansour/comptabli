"""
Extraction de données de factures par Regex + Heuristiques.
Supporte : FR, EN, ES, DE — PDF natifs, scannés, images.
Tolérant aux erreurs OCR courantes.
"""
import re
from typing import Optional

# ─── Devise ───────────────────────────────────────────────────────────────────
DEVISES_RE = r"(?:EUR|€|TND|DT|MAD|USD|\$|GBP|£|DNT|EURO)"

# ─── Montant ──────────────────────────────────────────────────────────────────
_MONTANT_RE = r"(?:" + DEVISES_RE + r"\s*)?(\d[\d\s,\.]{0,12}\d)(?:\s*" + DEVISES_RE + r")?"

# ─── Mots génériques à exclure ────────────────────────────────────────────────
_MOTS_GENERIQUES = {
    "INVOICE", "FACTURE", "DEVIS", "QUOTATION", "PROFORMA", "RECEIPT",
    "RECU", "BON", "NOTE", "BILL", "STATEMENT", "RECHNUNG", "FACTURA",
    "DATE", "TOTAL", "MONTANT", "CLIENT", "FOURNISSEUR", "VENDEUR",
    "PAIEMENT", "PAYMENT", "REFERENCE",
}

# ─── Patterns ─────────────────────────────────────────────────────────────────
PATTERNS = {
    "fournisseur": [
        # FR explicite
        r"(?:vendeur|fournisseur|emis?\s*par|de\s*la\s*part\s*de|societe|entreprise|emetteur)\s*[:\-]?\s*[\n\r]*\s*([A-Za-z\u00c0-\u017f][^\n]{2,60})",
        # EN explicite
        r"(?:from|vendor|seller|billed\s*from|remit\s*to|issued\s*by)\s*[:\-]?\s*[\n\r]*\s*([A-Z][^\n]{2,60})",
        # Forme juridique
        r"([A-Za-z\u00c0-\u017f][A-Za-z\u00c0-\u017f \t&\.\-]{2,50}[ \t]*(?:S\.?A\.?R\.?L\.?|SARL|SAS|EURL|LLC|LTD|GMBH|S\.?A\.?|INC\.?)[,\.]?)",
        # Première ligne avant l'adresse
        r"^([A-Za-z\u00c0-\u017f][A-Za-z\u00c0-\u017f\s&\.\-]{3,50})\n[^\n]*(?:rue|avenue|boulevard|all.e|impasse|chemin|bp|cedex|street|road|av\.|blvd)",
    ],
    "client": [
        # FR
        r"\b(?:factur.\s*..|adress.\s*..|client|destinataire|acheteur|pour)\b\s*[:\-]?\s*[\n\r]*\s*([A-Za-z\u00c0-\u017f][^\n]{2,60})",
        # EN
        r"\b(?:bill\s*to|sold\s*to|ship\s*to|customer|buyer|to)\b\s*[:\-]?\s*[\n\r]*\s*([A-Z][^\n]{2,60})",
        # Bloc "Client\n\nMichel"
        r"(?:client|customer)\s*[\n\r]+\s*([A-Za-z\u00c0-\u017f][^\n]{3,60})",
    ],
    "numero_facture": [
        # FR labels — le numéro doit commencer par un chiffre (évite "Paiement")
        r"(?:facture\s*n[\u00b0o\u00ba]?|num[e\u00e9]ro\s*(?:de\s*)?facture|n[\u00b0o]\s*(?:de\s*)?facture)\s*[:\-]?\s*(\d[\w\-\/\.]{0,20})",
        # EN labels
        r"(?:invoice\s*[#n][o\u00b0]?\.?|inv\.?\s*[#n][o\u00b0]?\.?|invoice\s*number)\s*[:\-]?\s*([A-Z0-9][\w\-\/\.]{1,25})",
        # Codes préfixés: CRK-2025-001, F-001, INV-123 — DOIT contenir un chiffre
        r"\b([A-Z]{1,5}[\-\/][A-Z0-9][\w\-\/]{0,10}\d[\w\-\/]{0,10})\b",
        # N° simple après #
        r"#\s*([A-Za-z0-9\-\/]{2,25})",
        # N° simple (2 à 10 chiffres purs)
        r"\bN[\u00b0o]\s*[:\-]?\s*(\d{2,10})\b",
        # Tabulaire: numéro pur sur la ligne après le label (OCR cassé: Num.ro)
        r"(?:num.ro|numero|invoice|facture)[^\n]{0,80}\n\s*(\d{1,15})(?:\s|$)",
        r"(?:num.ro|numero|invoice|facture)[^\n]{0,100}\n[^\n]{0,100}\n\s*(\d{1,15})(?:\s|$)",
        # Fallback tabulaire lourd: un nombre suivi d'une date sur la même ligne
        r"(?:^|\n)\s*([A-Z0-9\-\/]{2,15})\s+(?:\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})",
    ],
    "date": [
        # Labels explicites avec colon
        r"(?:date\s*(?:de\s*(?:facturation|facture|la\s*facture)|d..\u00e9mission)?|invoice\s*date|issue\s*date|fecha|datum)\s*:\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{2,4})",
        r"(?:date\s*(?:de\s*(?:facturation|facture))?|invoice\s*date)\s*:\s*([A-Za-z\u00c0-\u017f]{3,12}\.?\s+\d{1,2},?\s+\d{4})",
        r"(?:date\s*(?:de\s*(?:facturation|facture))?|invoice\s*date)\s*:\s*(\d{1,2}\s+[A-Za-z\u00c0-\u017f]{3,12}\.?\s+\d{4})",
        # Tabulaire: valeur sur la ligne suivante
        r"(?:date\s*de\s*facturation|invoice\s*date)[^\n]{0,50}\n\s*(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4})",
        # Date ISO
        r"\b(\d{4}-\d{2}-\d{2})\b",
        # Date DD.MM.YYYY / DD/MM/YYYY (bare fallback)
        r"(?<!\d)(\d{1,2}[\.\/\-]\d{1,2}[\.\/\-]\d{4})(?!\d)",
        # Date "2.6.2021" format court
        r"(?<!\d)(\d{1,2}\.\d{1,2}\.\d{4})(?!\d)",
    ],
    "total_ht": [
        # FR — tolérant aux erreurs OCR: TotalHT, TotaluT, Totat HT, Total h.t.
        r"(?:total[\s\-]?h\.?t\.?|totalut|totat\s*[uh]t|montant\s*h\.?t\.?|sous[\-\s]?total|hors\s*taxe|ht\s*:)\s*[:\-]?\s*" + _MONTANT_RE,
        r"(?:^|\n)\s*total\s+h\.?t\.?\s+" + _MONTANT_RE,
        # EN
        r"(?:subtotal|sub-total|net\s*amount|amount\s*before\s*tax|taxable\s*amount)\s*[:\-]?\s*" + _MONTANT_RE,
        # ES/DE
        r"(?:base\s*imponible|nettobetrag|netto)\s*[:\-]?\s*" + _MONTANT_RE,
    ],
    "tva": [
        # FR — exiger au moins 3 chiffres ou décimale (évite "00" seul)
        r"(?:total[\s\-]?t\.?v\.?a\.?|totaltva|totai\s*tva|montant\s*(?:de\s*la\s*)?t\.?v\.?a\.?)\s*[:\-]?\s*(?:" + DEVISES_RE + r"\s*)?(\d{2,}[,\.]\d+|\d{3,})",
        r"(?:total\s*tva|tva\s*:)\s*[:\-]?\s*(?:" + DEVISES_RE + r"\s*)?(\d{2,}[,\.]\d+|\d{3,})",
        r"(?:t\.?v\.?a\.?)\s*(?:\(?\s*\d{1,2}\s*%?\s*\)?)?\s*[:\-]?\s*(?:" + DEVISES_RE + r"\s*)?(\d{2,}[,\.]\d+|\d{3,})",
        # EN
        r"(?:sales\s*tax|vat(?:\s*amount)?|tax(?:\s*amount)?|gst|hst)\s*[:\-]?\s*" + _MONTANT_RE,
        r"(?:^|\n)\s*total\s+tva\s+" + _MONTANT_RE,
    ],
    "total_ttc": [
        # FR — tolérant aux erreurs OCR: TotaiTTC, Totai TTC, TotaiTTC 162000
        r"(?:total[\s\-]?t\.?t\.?c\.?|totaitc|totaittc|totai[\s\-]?ttc|net\s*[\u00e0a]\s*payer|montant\s*total(?:\s*ttc)?|total\s*g\u00e9n\u00e9ral)\s*[:\-]?\s*" + _MONTANT_RE,
        r"(?:^|\n)\s*total\s+ttc\s+" + _MONTANT_RE,
        # EN
        r"(?:total\s*due|balance\s*due|amount\s*due|grand\s*total|total\s*amount|please\s*pay)\s*" + _MONTANT_RE,
        # Ligne solo "Total : 1 620,00"
        r"(?:^|\n)\s*total\s*[:\-]?\s*" + _MONTANT_RE,
        # ES/DE
        r"(?:total\s*a\s*pagar|importe\s*total|gesamtbetrag|gesamtsumme)\s*" + _MONTANT_RE,
    ],
    "devise": [
        r"(?:^|\s)(EUR|€|TND|DT|MAD|USD|\$|GBP|£|DNT)(?:\s|$)",
    ],
    "identifiants": [
        r"\b([A-Z]{2}\d{2}[A-Z0-9]{4,30})\b",
        r"\b(SIRET\s*:?\s*\d{14})\b",
        r"\b(SIREN\s*:?\s*\d{9})\b",
        r"\b(ICE\s*:?\s*\d{15})\b",
        r"\b(MF\s*:?\s*[\w\/]{5,20})\b",
        r"\b(VAT\s*:?\s*[A-Z]{2}[A-Z0-9]{6,12})\b",
        r"(?:identifiant\s*fiscal|matricule\s*fiscal|tax\s*id|tva\s*intracommunautaire)\s*[:\-]?\s*([\w\/\s]{5,25})",
        r"\b(NIF\s*:?\s*[A-Z0-9]{7,12})\b",
        r"\b(RC\s*:?\s*[A-Z0-9]{5,20})\b",
    ],
}


# ─────────────────────────────────────────────────────────────────────────────
# Fonctions utilitaires
# ─────────────────────────────────────────────────────────────────────────────

def _chercher(texte: str, patterns: list) -> Optional[str]:
    for p in patterns:
        try:
            m = re.search(p, texte, re.IGNORECASE | re.MULTILINE)
            if m:
                return m.group(1).strip()
        except re.error:
            continue
    return None


def _chercher_fournisseur(texte: str) -> Optional[str]:
    for p in PATTERNS["fournisseur"]:
        try:
            for m in re.finditer(p, texte, re.IGNORECASE | re.MULTILINE):
                val = m.group(1).strip()
                mots = val.upper().split()
                if not mots or mots[0] in _MOTS_GENERIQUES:
                    continue
                if len(val) < 3 or re.match(r'^[\d\s,\.]+$', val):
                    continue
                return val
        except re.error:
            continue
    return None

def _chercher_client(texte: str) -> Optional[str]:
    for p in PATTERNS["client"]:
        try:
            for m in re.finditer(p, texte, re.IGNORECASE | re.MULTILINE):
                val = m.group(1).strip()
                if val.lower().startswith("date") or val.lower().startswith("invoice"):
                    # Si on a capturé "Date: ...", on regarde la ligne en-dessous
                    lignes = texte[m.start():].splitlines()
                    for i, l in enumerate(lignes):
                        l = l.strip()
                        if l and not l.lower().startswith("date") and not l.lower().startswith("invoice") and not l.lower().startswith("bill to") and not l.lower().startswith("client"):
                            return l
                return val
        except re.error:
            continue
    return None

def _nettoyer_montant(valeur: str) -> Optional[str]:
    if not valeur:
        return None
    v = re.sub(r"(?:EUR|€|TND|DT|MAD|USD|\$|GBP|£|DNT|EURO)", "", valeur, flags=re.IGNORECASE).strip()
    v = re.sub(r"(\d)\s+(\d)", r"\1\2", v)
    v = re.sub(r"[^\d,\.]", "", v)
    if not v:
        return None
    lc, ld = v.rfind(","), v.rfind(".")
    if "," in v and "." in v:
        v = v.replace(".", "").replace(",", ".") if lc > ld else v.replace(",", "")
    elif "," in v:
        v = v.replace(",", ".")
    try:
        f = float(v)
        if f <= 0:
            return None
        return v
    except ValueError:
        return None


def _extraire_tous_montants(texte: str) -> list:
    pattern = r"(?:" + DEVISES_RE + r"\s*)?(\d[\d\s]{0,6}\d[,\.]\d{2})(?:\s*" + DEVISES_RE + r")?"
    montants = []
    for m in re.finditer(pattern, texte, re.IGNORECASE):
        val = _nettoyer_montant(m.group(1))
        if val:
            try:
                montants.append(float(val))
            except ValueError:
                pass
    return sorted(set(montants), reverse=True)


def _heuristique_montants(texte: str, donnees: dict) -> dict:
    result = dict(donnees)

    # Si TTC et HT présents, compléter TVA
    if result.get("total_ttc") and result.get("total_ht") and not result.get("tva"):
        try:
            tva = float(result["total_ttc"]) - float(result["total_ht"])
            if tva > 0:
                result["tva"] = str(round(tva, 3))
        except (ValueError, TypeError):
            pass
        return result

    if result.get("total_ttc") and result.get("total_ht"):
        return result

    montants = _extraire_tous_montants(texte)
    if not montants:
        return result

    if not result.get("total_ttc") and len(montants) >= 1:
        result["total_ttc"] = str(montants[0])

    if not result.get("total_ht") and len(montants) >= 2:
        ttc = float(result["total_ttc"]) if result.get("total_ttc") else 0
        for m in montants[1:]:
            if m < ttc * 0.995:
                result["total_ht"] = str(m)
                break

    if not result.get("tva") and result.get("total_ttc") and result.get("total_ht"):
        try:
            tva = float(result["total_ttc"]) - float(result["total_ht"])
            if tva > 0:
                result["tva"] = str(round(tva, 3))
        except (ValueError, TypeError):
            pass

    if result != donnees:
        result["methode"] = "regex+heuristique"
    return result


# ─────────────────────────────────────────────────────────────────────────────
# EXTRACTION DES LIGNES D'ARTICLES
# ─────────────────────────────────────────────────────────────────────────────

_HEADER_KW = re.compile(
    r"\b(d.signation|designation|description|libell.|libelle|item|article)\b",
    re.IGNORECASE,
)
_FOOTER_KW = re.compile(
    r"\b(sous.?total|subtotal|sub-total|total\s*h\.?t|total\s*t\.?t\.?c|total\s*due|"
    r"balance\s*due|net\s*[\u00e0a]\s*payer|montant\s*total|total\s*g.n.ral|grand\s*total)\b",
    re.IGNORECASE,
)

_LIGNE_ARTICLE = re.compile(
    r"^(?P<desc>[A-Za-z\u00c0-\u017f\-][A-Za-z0-9\s\-\./,&']{1,60}?)"
    r"\s+(?P<qty>\d{1,6}(?:[,\.]\d{1,3})?)"          # quantité : jusqu'à 6 chiffres
    r"(?:\s+(?P<unit>[a-zA-Z\.]{1,8}))?"             # unité optionnelle
    r"\s+(?:(?:" + DEVISES_RE + r")\s*)?(?P<rate>\d{1,8}(?:[,\.]\d{1,3})?)"
    r"(?:[^\d\n]+(?P<tva>\d{1,3})\s*%)?"
    r"[^\d\n]*"
    r"(?P<amount>(?:\d{1,3}(?:\s\d{3})+|\d{1,10})(?:[,\.]\d{1,3})?)"
    r"(?:\s*(?:" + DEVISES_RE + r"))?\s*$",
    re.IGNORECASE,
)

_LIGNE_SIMPLE = re.compile(
    r"^(?P<desc>[A-Za-z\u00c0-\u017f\-][A-Za-z\u00c0-\u017f0-9\s\-\./,&']{2,60})"
    r"\s{3,}(?P<amount>[\d][\d\s,\.]{1,15})(?:\s*" + DEVISES_RE + r")?\s*$",
    re.IGNORECASE,
)

# Pattern pour les lignes où seuls les montants sont présents (la description était au-dessus)
# ex: "5 h 60.00 € 20 % 60.00 € 3680.00 €"
_LIGNE_MONTANTS_SEULS_TVA = re.compile(
    r"^\s*(?:(?P<qty>\d{1,6}(?:[,\.]\d{1,3})?)\s+)?\s*"
    r"(?:(?:[a-zA-Z\.]{1,8}|\|)\s*)?(?:(?:" + DEVISES_RE + r"|\|)\s*)?(?P<rate>(?:\d{1,3}(?:\s\d{3})+|\d{1,10})(?:[,\.]\d{1,3})?)"
    r"[^\d\n]+(?P<tva>\d{1,3})\s*%"
    r"[^\d\n]*"
    r"(?P<amount>(?:\d{1,3}(?:\s\d{3})+|\d{1,10})(?:[,\.]\d{1,3})?)"
    r"(?:\s*(?:" + DEVISES_RE + r"|\|))?\s*$",
    re.IGNORECASE,
)

_LIGNE_MONTANTS_SEULS = re.compile(
    r"^\s*(?P<qty>\d{1,6}(?:[,\.]\d{1,3})?)\s*(?:[a-zA-Z\.]{1,8}\s*)?"
    r"(?:(?:[^\d\n]+)?(?P<rate>\d{1,8}[\d\s,\.]*\d))?"
    r".*?(?P<amount>\d{1,10}[\d\s,\.]*\d)\s*(?:[^\d\n]*)?$",
    re.IGNORECASE,
)


def _normaliser_ligne_article(ligne: str) -> str:
    """
    Normalise une ligne extraite par OCR pour corriger les espaces parasites
    insérés dans les nombres multi-chiffres (ex: "1 0" -> "10", "2 0" -> "20").
    
    Le problème : Tesseract avec PSM 6 peut insérer un espace entre les chiffres
    d'un nombre quand les colonnes sont très espacées dans le tableau.
    La correction : on reconstitue les chiffres adjacents séparés par un seul espace
    UNIQUEMENT quand ils sont entourés d'espaces (contexte colonne).
    """
    # Corriger les entiers découpés : "1 0 pce" -> "10 pce", "2 0 pce" -> "20 pce"
    # Pattern : chiffre(s), espace simple, chiffre(s), espace multiple ou lettre
    # On répète jusqu'à stabilisation pour gérer "1 0 3" -> "103"
    for _ in range(4):
        prev = ligne
        # Un seul espace entre deux séquences de chiffres suivies d'espace ou fin
        ligne = re.sub(r'(?<=\d) (?=\d(?:\s|[a-zA-Z,\.€$]|$))', '', ligne)
        if ligne == prev:
            break
    return ligne


def extraire_lignes_facture(texte: str) -> list:
    lines = texte.splitlines()
    lignes_article = []

    debut_table = None
    fin_table = len(lines)
    for i, l in enumerate(lines):
        if debut_table is None and _HEADER_KW.search(l):
            debut_table = i + 1
        elif debut_table is not None and _FOOTER_KW.search(l):
            fin_table = i
            break

    if debut_table is None:
        debut_table = 0

    zone = lines[debut_table:fin_table]
    last_text_line = ""

    for l_raw in zone:
        l_raw = l_raw.strip()
        if not l_raw or len(l_raw) < 3:
            continue
        if _HEADER_KW.search(l_raw) or _FOOTER_KW.search(l_raw):
            continue

        # Normaliser pour corriger les espaces parasites OCR dans les quantités
        l = _normaliser_ligne_article(l_raw)

        # Essayer le pattern complet
        m = _LIGNE_ARTICLE.match(l)
        if m:
            desc = m.group("desc").strip()
            mots_desc = [w.upper() for w in desc.split()]
            if all(w in _MOTS_GENERIQUES for w in mots_desc):
                last_text_line = l
                continue
            qty = m.group("qty") or "1"
            rate = _nettoyer_montant(m.group("rate") or "")
            amount = _nettoyer_montant(m.group("amount") or "")
            if amount:
                lignes_article.append({
                    "description": desc,
                    "quantite": qty.strip(),
                    "prix_unitaire": rate,
                    "montant": amount,
                })
                last_text_line = ""
            continue
            
        # Essayer le pattern montants seuls avec TVA (associés à la ligne précédente)
        m_tva = _LIGNE_MONTANTS_SEULS_TVA.match(l)
        if m_tva and last_text_line:
            desc = last_text_line.strip()
            qty = m_tva.group("qty") or "1"
            if qty == "0": qty = "1"
            rate = _nettoyer_montant(m_tva.group("rate") or "")
            amount = _nettoyer_montant(m_tva.group("amount") or "")
            if amount and not any(w in desc.upper() for w in ["TOTAL", "TVA"]):
                lignes_article.append({
                    "description": desc,
                    "quantite": qty,
                    "prix_unitaire": rate,
                    "montant": amount,
                })
                last_text_line = ""
                continue
            
        # Essayer le pattern montants seuls classique (associés à la ligne précédente)
        m_seul = _LIGNE_MONTANTS_SEULS.match(l)
        if m_seul and last_text_line:
            desc = last_text_line.strip()
            qty = m_seul.group("qty") or "1"
            if qty == "0": qty = "1"
            rate = _nettoyer_montant(m_seul.group("rate") or "")
            amount = _nettoyer_montant(m_seul.group("amount") or "")
            if amount:
                # Vérifier si on n'a pas capturé une ligne de pied par erreur
                if not any(w in desc.upper() for w in ["TOTAL", "TVA"]):
                    lignes_article.append({
                        "description": desc,
                        "quantite": qty.strip(),
                        "prix_unitaire": rate,
                        "montant": amount,
                    })
                    last_text_line = ""
                    continue
                
        # Sauvegarder la ligne de texte pour la prochaine itération
        if not re.search(r'\d[\d\s,\.]+\d', l): # Si ce n'est pas juste des chiffres
            last_text_line = l

    if not lignes_article:
        for l in zone:
            l = l.strip()
            if not l or _HEADER_KW.search(l) or _FOOTER_KW.search(l):
                continue
            m = _LIGNE_SIMPLE.match(l)
            if m:
                desc = m.group("desc").strip()
                amount = _nettoyer_montant(m.group("amount") or "")
                mots_desc = [w.upper() for w in desc.split()]
                if amount and not all(w in _MOTS_GENERIQUES for w in mots_desc):
                    lignes_article.append({
                        "description": desc,
                        "quantite": "1",
                        "prix_unitaire": None,
                        "montant": amount,
                    })

    return lignes_article


# ─────────────────────────────────────────────────────────────────────────────
# EXTRACTION PRINCIPALE
# ─────────────────────────────────────────────────────────────────────────────

def extraire_avec_regex(texte: str) -> dict:
    identifiants = []
    for p in PATTERNS["identifiants"]:
        try:
            for m in re.finditer(p, texte, re.IGNORECASE):
                identifiants.append(m.group(0).strip())
        except re.error:
            continue

    donnees = {
        "fournisseur":    _chercher_fournisseur(texte),
        "client":         _chercher_client(texte) or _chercher(texte, PATTERNS["client"]),
        "numero_facture": _chercher(texte, PATTERNS["numero_facture"]),
        "date_emission":  _chercher(texte, PATTERNS["date"]),
        "total_ht":       _nettoyer_montant(_chercher(texte, PATTERNS["total_ht"]) or ""),
        "tva":            _nettoyer_montant(_chercher(texte, PATTERNS["tva"]) or ""),
        "total_ttc":      _nettoyer_montant(_chercher(texte, PATTERNS["total_ttc"]) or ""),
        "devise":         _chercher(texte, PATTERNS["devise"]),
        "lignes":         extraire_lignes_facture(texte),
        "identifiants":   list(set(identifiants)),
        "methode":        "regex",
    }

    donnees = _heuristique_montants(texte, donnees)
    return donnees
