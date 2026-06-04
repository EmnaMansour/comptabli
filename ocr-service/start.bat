@echo off
echo ===================================
echo  Comptabli OCR Service - Demarrage
echo ===================================

REM Activer l'environnement virtuel si présent
if exist venv\Scripts\activate.bat (
    call venv\Scripts\activate.bat
)

REM Copier le modèle CRF depuis ml_factures s'il existe
if not exist modeles\modele_facture.pkl (
    if exist ..\ml_factures\modeles\modele_facture.pkl (
        mkdir modeles 2>nul
        copy ..\ml_factures\modeles\modele_facture.pkl modeles\
        echo Modele CRF copie depuis ml_factures
    )
)

echo Lancement du microservice OCR sur le port 8001...
.\venv\Scripts\uvicorn main:app --host 0.0.0.0 --port 8001 --reload
