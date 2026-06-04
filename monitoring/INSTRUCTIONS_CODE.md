# Intégration du Monitoring dans le Code Source (Comptabli)

Voici les instructions précises pour intégrer les métriques Prometheus dans vos applications FastAPI et NestJS.

## 1. Pour FastAPI (ocr-service)

**Étape 1 :** Ajoutez la librairie au fichier `c:\comptabli\ocr-service\requirements.txt` :
```text
prometheus-fastapi-instrumentator==6.1.0
```

**Étape 2 :** Modifiez `c:\comptabli\ocr-service\main.py` pour importer et activer l'instrumentator :
```python
from fastapi import FastAPI
from prometheus_fastapi_instrumentator import Instrumentator # <-- AJOUT

app = FastAPI(title="OCR Service")

# ... vos routes ...

# <-- AJOUT : Exposer /metrics à la fin du fichier
Instrumentator().instrument(app).expose(app)
```

**Étape 3 :** (Optionnel) Pour ajouter des métriques custom (ex: taille du modèle CRF), utilisez la librairie standard `prometheus_client`.
```python
from prometheus_client import Gauge
crf_model_loaded = Gauge('crf_model_loaded', 'Vaut 1 si le modèle CRF est chargé, 0 sinon')
# Quand le modèle charge : crf_model_loaded.set(1)
```

---

## 2. Pour NestJS (backend)

**Étape 1 :** Ajoutez les packages dans `c:\comptabli\backend\package.json` :
```bash
# Exécutez ceci dans le dossier backend/
npm install @willsoto/nestjs-prometheus prom-client
```

**Étape 2 :** Importez le module dans `c:\comptabli\backend\src\app.module.ts` :
```typescript
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics', // expose sur localhost:3000/metrics
    }),
    // ... vos autres modules
  ],
})
export class AppModule {}
```

**Étape 3 :** (Optionnel) Pour une métrique custom (ex: factures processées) :
```typescript
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

// Dans un module métier
providers: [
  makeCounterProvider({
    name: 'invoices_processed_total',
    help: 'Total number of processed invoices',
  }),
]
```

---

## 3. Commandes Finales & Tests

Une fois le code mis à jour (les modifications du `docker-compose.yml` ont déjà été faites par l'IA), voici comment procéder :

1. **Reconstruire les images modifiées et lancer la stack entière :**
```powershell
docker compose up -d --build
```

2. **Accéder à Grafana :**
   - URL : `http://localhost:3001`
   - Utilisateur : `admin`
   - Mot de passe : défini dans le `.env` (`GRAFANA_ADMIN_PASSWORD` = `change_me_monitoring`)
   - Allez dans "Dashboards", votre *Comptabli Overview* est déjà prêt.

3. **Vérifier Prometheus :**
   - URL : `http://localhost:9090/targets`
   - Vous devez voir toutes les cibles (backend, ocr, postgres, node) en "UP".

4. **Tester Alertmanager (Emails) :**
   - Renseignez de vrais identifiants SMTP dans le `.env`.
   - Éteignez l'OCR (`docker compose stop ocr-service`).
   - Au bout de 1 minute, Prometheus passera l'alerte `ServiceDown` en rouge et l'enverra à Alertmanager, qui vous notifiera par email.
