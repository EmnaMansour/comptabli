.PHONY: help build up down logs logs-ocr db-shell restart-ocr

help:
	@echo "Commandes disponibles :"
	@echo "  make build       - Builder toutes les images Docker"
	@echo "  make up          - Lancer tous les services en arriere-plan"
	@echo "  make down        - Arreter et supprimer tous les conteneurs"
	@echo "  make logs        - Afficher les logs de tous les services"
	@echo "  make logs-ocr    - Afficher uniquement les logs du service OCR"
	@echo "  make db-shell    - Ouvrir un shell interactif dans la DB PostgreSQL"
	@echo "  make restart-ocr - Redemarrer uniquement le service OCR"

build:
	docker compose build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

logs-ocr:
	docker compose logs -f ocr-service

db-shell:
	docker compose exec postgres psql -U comptabli -d comptabli_db

restart-ocr:
	docker compose restart ocr-service
