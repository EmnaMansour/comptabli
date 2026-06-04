import traceback
from app.ocr.text_extraction import extraire_lignes_image
data = open(r'c:\comptabli\backend\uploads\1778864503706-t__l__chargement.png.png', 'rb').read()
try:
    print("EXTRACTION LIGNES:")
    for l in extraire_lignes_image(data):
        print(l)
except Exception as e:
    traceback.print_exc()
