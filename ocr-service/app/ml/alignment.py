import re
from typing import List, Tuple, Dict, Any

def tokenize_with_indices(text: str) -> List[Tuple[str, int, int]]:
    """
    Tokenise le texte et retourne (token, start, end).
    Identique à la logique utilisée par text2tokens dans features.py.
    """
    # On utilise une regex simple pour les tokens (mots et ponctuation)
    tokens = []
    for match in re.finditer(r"\w+|[^\w\s]", text):
        tokens.append((match.group(), match.start(), match.end()))
    return tokens

def align_annotations_to_tokens(text: str, annotations: Dict[str, Any]) -> List[str]:
    """
    Prend un texte brut et un dictionnaire d'annotations (champs extraits)
    et retourne une liste de tags BIO correspondant aux tokens du texte.
    """
    tokens_with_indices = tokenize_with_indices(text)
    tags = ["O"] * len(tokens_with_indices)
    
    # Mapper pour les labels (fournisseur -> FOURNISSEUR, etc.)
    label_map = {
        "fournisseur": "FOURNISSEUR",
        "client": "CLIENT",
        "numero_facture": "NUMERO",
        "date_emission": "DATE",
        "total_ht": "TOTAL_HT",
        "tva": "TVA",
        "total_ttc": "TOTAL_TTC",
        "devise": "DEVISE"
    }

    for field, value in annotations.items():
        if not value or field not in label_map:
            continue
        
        label = label_map[field]
        val_str = str(value).strip()
        if not val_str:
            continue
            
        # Chercher la valeur dans le texte (recherche simple de la première occurrence)
        # TODO: Améliorer avec une recherche floue si nécessaire
        start_char = text.find(val_str)
        if start_char == -1:
            # Essayer une recherche insensible à la casse
            match = re.search(re.escape(val_str), text, re.IGNORECASE)
            if match:
                start_char = match.start()
            else:
                continue
                
        end_char = start_char + len(val_str)
        
        # Assigner les tags BIO aux tokens correspondants
        first = True
        for i, (tok, s, e) in enumerate(tokens_with_indices):
            # Si le token est à l'intérieur de la plage de la valeur annotée
            if s >= start_char and e <= end_char:
                if first:
                    tags[i] = f"B-{label}"
                    first = False
                else:
                    tags[i] = f"I-{label}"
    
    return tags
