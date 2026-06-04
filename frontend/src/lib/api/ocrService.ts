import { authFetch } from '../authFetch';

/**
 * Lance l'extraction OCR sur un document (catégorie Facturation).
 * Le traitement est asynchrone côté serveur (202 Accepted).
 */
export async function lancerExtraction(documentId: string): Promise<{ ok: boolean; message?: string }> {
  try {
    const res = await authFetch(`/ocr/extraire/${documentId}`, { method: 'POST' });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, message: body.message || `Erreur ${res.status}` };
    }
    return { ok: true };
  } catch (err: any) {
    return { ok: false, message: err.message || 'Erreur réseau' };
  }
}

export interface OcrField {
  value: string;
  confidence: number;
}

export interface OcrResultat {
  statut: string;
  fournisseur?: string | OcrField;
  client?: string | OcrField;
  numero_facture?: string | OcrField;
  date_emission?: string | OcrField;
  total_ht?: string | OcrField;
  tva?: string | OcrField;
  total_ttc?: string | OcrField;
  devise?: string | OcrField;
  lignes?: { description: string; quantite: string; prix_unitaire?: string | OcrField; montant?: string | OcrField }[];
  identifiants?: string[];
  confiance?: string | number;
  methode?: string;
  temps_traitement?: number;
  summary?: string;
  message?: string;
}

/**
 * Récupère le résultat OCR d'un document (polling).
 * Statuts possibles : PAS_ENCORE_EXTRAIT, EN_COURS, TERMINE, ERREUR
 */
export async function obtenirResultat(documentId: string): Promise<OcrResultat> {
  try {
    const res = await authFetch(`/ocr/resultat/${documentId}`);
    if (!res.ok) {
      return { statut: 'ERREUR', message: `Erreur ${res.status}` };
    }
    return await res.json();
  } catch (err: any) {
    return { statut: 'ERREUR', message: err.message || 'Erreur réseau' };
  }
}

/**
 * Polling helper : appelle obtenirResultat toutes les `intervalMs` ms
 * jusqu'à ce que le statut soit TERMINE ou ERREUR.
 * Retourne le résultat final.
 */
export function pollerResultat(
  documentId: string,
  onUpdate: (result: OcrResultat) => void,
  intervalMs = 2000,
  maxAttempts = 60,
): { stop: () => void } {
  let attempt = 0;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const poll = async () => {
    if (stopped) return;
    attempt++;

    const result = await obtenirResultat(documentId);
    onUpdate(result);

    if (result.statut === 'TERMINE' || result.statut === 'ERREUR' || attempt >= maxAttempts) {
      return; // Arrêter le polling
    }

    timer = setTimeout(poll, intervalMs);
  };

  // Démarrer après un petit délai pour laisser le backend lancer le traitement
  timer = setTimeout(poll, 1000);

  return {
    stop: () => {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
