FROM python:3.10-slim

# Empêcher Python de générer des fichiers .pyc et forcer l'affichage immédiat des logs
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

# Variable d'environnement pour Tesseract (chemin par défaut sur Debian)
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata

WORKDIR /app

# Installation des dépendances système requises pour l'OCR et OpenCV
RUN apt-get update && apt-get install -y --no-install-recommends \
    tesseract-ocr \
    tesseract-ocr-fra \
    tesseract-ocr-eng \
    tesseract-ocr-ara \
    libgl1 \
    libglib2.0-0 \
    poppler-utils \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Création d'un utilisateur non-root pour la sécurité
RUN groupadd -r ocruser && useradd -r -g ocruser appuser

# Copier les dépendances Python
COPY requirements.txt .

# Mettre à jour pip et installer les dépendances
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copier le code source de l'application
COPY . .

# S'assurer que les dossiers nécessaires pour le modèle et les logs existent
# et donner les permissions à l'utilisateur non-root
RUN mkdir -p /app/app/ml/feedbacks /app/logs && \
    chown -R appuser:ocruser /app

# Basculer sur l'utilisateur non-root
USER appuser

# Exposer le port du microservice
EXPOSE 8000

# Lancer l'application avec Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
