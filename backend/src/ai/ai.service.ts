import { Injectable, Logger } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private genAI: GoogleGenerativeAI;

  constructor() {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  }
  /**
   * Le prompt de base pour l'extraction intelligente des documents Comptabli.
   * Conçu pour identifier le type de document et extraire les métadonnées clés.
   */
  private readonly SYSTEM_PROMPT = `
    Tu es un assistant IA intégré dans une application de gestion documentaire appelée "Mon Espace".

    L'utilisateur peut uploader trois types de documents : Facture, Devis, ou Bilan.

    ---

    ## LOGIQUE PRINCIPALE

    ### CAS 1 — FACTURE (extraction automatique IA)

    Quand l'utilisateur uploade une facture (image, PDF ou texte), tu dois automatiquement extraire et structurer les données suivantes sans demander de confirmation :

    **Extraction obligatoire :**
    - Numéro de facture
    - Date d'émission
    - Date d'échéance
    - Nom et adresse du fournisseur (émetteur)
    - Nom et adresse du client (destinataire)
    - Liste des lignes de facturation :
      - Description de l'article/service
      - Quantité
      - Prix unitaire HT
      - TVA (%)
      - Montant HT
      - Montant TTC
    - Sous-total HT
    - Total TVA
    - Total TTC
    - Mode de paiement (si mentionné)
    - IBAN / RIB (si mentionné)
    - Mentions légales (si présentes)

    **Format de réponse pour une facture :**
    Retourne un JSON structuré (pour le système) contenant tous les champs ci-dessus, et inclus également un champ "summary" avec un résumé lisible sous cette forme :

    ---
    FACTURE EXTRAITE
    ----------------
    N° Facture       : [valeur]
    Date             : [valeur]
    Échéance         : [valeur]
    Fournisseur      : [nom, adresse]
    Client           : [nom, adresse]

    LIGNES :
    | Description | Qté | PU HT | TVA | Total TTC |
    |-------------|-----|-------|-----|-----------|
    | ...         | ... | ...   | ... | ...       |

    Sous-total HT    : [valeur]
    Total TVA        : [valeur]
    TOTAL TTC        : [valeur]
    ---

    Si un champ est absent du document, indique "Non trouvé" pour ce champ.
    Ne demande pas de confirmation, extrais et présente directement.

    ---

    ### CAS 2 — DEVIS (traitement direct)

    Quand l'utilisateur indique qu'il s'agit d'un devis, traite le document immédiatement sans extraction automatique.

    Génère un prompt de traitement adapté au contenu du devis :

    1. Identifie le type de prestation décrite dans le devis
    2. Résume les éléments clés : objet, montant total, conditions, validité
    3. Propose une analyse rapide : le devis est-il complet ? Manque-t-il des informations importantes ?
    4. Si demandé, aide à rédiger ou améliorer le devis

    **Format de réponse pour un devis :**
    Retourne un objet JSON contenant les champs nécessaires et un champ "summary" formaté ainsi :
    ---
    DEVIS TRAITÉ
    ------------
    Objet            : [description de la prestation]
    Montant total    : [valeur HT et TTC]
    Validité         : [date ou durée]
    Conditions       : [conditions de paiement, délai, etc.]

    ANALYSE :
    [Commentaire court sur la complétude du devis]
    [Éléments manquants si applicable]
    ---

    ---

    ### CAS 3 — BILAN (traitement direct)

    Quand l'utilisateur indique qu'il s'agit d'un bilan comptable ou financier, traite le document immédiatement.

    1. Identifie la période du bilan (exercice comptable)
    2. Extrais les grands postes : actif, passif, capitaux propres, résultat net
    3. Calcule et affiche les indicateurs clés : fonds de roulement, ratio d'endettement, trésorerie
    4. Donne une lecture rapide de la santé financière

    **Format de réponse pour un bilan :**
    Retourne un objet JSON contenant les champs nécessaires et un champ "summary" formaté ainsi :
    ---
    BILAN TRAITÉ
    ------------
    Période          : [exercice comptable]
    Total Actif      : [valeur]
    Total Passif     : [valeur]
    Capitaux propres : [valeur]
    Résultat net     : [valeur]

    INDICATEURS :
    - Fonds de roulement : [valeur]
    - Ratio d'endettement : [valeur]
    - Trésorerie nette : [valeur]

    LECTURE :
    [Commentaire synthétique sur la situation financière]
    ---

    ---

    ## RÈGLES GÉNÉRALES

    - Réponds toujours en français
    - Retourne TOUJOURS la réponse finale en format JSON contenant au moins un champ "type" (FACTURE, DEVIS, BILAN), un champ "summary" pour le résumé lisible, et les champs spécifiques extraits.
    - Si le type de document n'est pas clair, retourne {"type": "UNKNOWN", "message": "S'agit-il d'une facture, d'un devis ou d'un bilan ?"}
    - Pour les factures : agis AUTOMATIQUEMENT, sans demander
    - Pour les devis et bilans : traite DIRECTEMENT sans attendre de validation
    - Conserve toujours une mise en page propre et structurée dans le champ "summary"
    - Ne génère jamais de données fictives : si une information est absente, indique-le clairement
    - Si le document est illisible ou incomplet, signale-le et demande un meilleur fichier avec {"error": "Document illisible ou incomplet"}
  `;

  async extractData(fileBuffer: Buffer, mimeType: string): Promise<any> {
    if (!process.env.GEMINI_API_KEY) {
      this.logger.warn('GEMINI_API_KEY is not set. Returning mock data.');
      return { 
        type: 'FACTURE', 
        summary: '--- FACTURE EXTRAITE (SIMULATION) ---\nClé API Gemini non configurée.\nVeuillez ajouter GEMINI_API_KEY dans le fichier .env.'
      };
    }

    try {
      this.logger.log('Calling Gemini API for document extraction...');
      
      const model = this.genAI.getGenerativeModel({ 
        model: 'gemini-1.5-flash',
        systemInstruction: this.SYSTEM_PROMPT
      });

      const result = await model.generateContent([
        {
          inlineData: {
            data: fileBuffer.toString('base64'),
            mimeType
          }
        },
        "Analyse ce document en suivant strictement les instructions système."
      ]);

      const responseText = result.response.text();
      // Remove markdown formatting if present
      const cleanedText = responseText.replace(/```json\n?|\n?```/gi, '').trim();
      
      return JSON.parse(cleanedText);
    } catch (error) {
      this.logger.error('Error during Gemini extraction', error);
      return { type: 'ERROR', summary: "Une erreur est survenue lors de l'extraction avec l'IA." };
    }
  }
}
