import traceback
from app.ocr.text_extraction import extraire_lignes_pdf
from app.ocr.fallback import extraire_avec_regex
import json

data = open(r'c:\comptabli\backend\uploads\1778866717570-Invoice_F-2024-0012.pdf.pdf', 'rb').read()
try:
    lignes = extraire_lignes_pdf(data)
    texte = '\n'.join(lignes)
    print("=== TEXTE BRUT ===")
    print(texte)
    print("=== EXTRACTION ===")
    res = extraire_avec_regex(texte)
    print(json.dumps(res, indent=2))
except Exception as e:
    traceback.print_exc()
