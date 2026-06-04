import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../prisma/prisma.service';
import { firstValueFrom } from 'rxjs';
import * as FormData from 'form-data';
import * as fs from 'fs';
import * as path from 'path';

const OCR_SERVICE_URL = process.env.OCR_SERVICE_URL ?? 'http://localhost:8001';

// Catégories pour lesquelles l'OCR est activé
const CATEGORIES_OCR = ['FACTURATION', 'FACTURE'];

interface LigneFacture {
  description: string;
  quantite: string;
  prix_unitaire?: string | null;
  montant?: string | null;
}

interface OcrResultatDto {
  fournisseur?: string | null;
  client?: string | null;
  numero_facture?: string | null;
  date_emission?: string | null;
  total_ht?: string | null;
  tva?: string | null;
  total_ttc?: string | null;
  devise?: string | null;
  lignes?: LigneFacture[];
  identifiants?: string[];
  confiance?: string;
  methode?: string;
  method?: string;
  global_confidence_score?: number;
  temps_traitement?: number;
  texte_brut?: string | null;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly http: HttpService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Lance l'extraction OCR sur un document, puis sauvegarde le résultat.
   */
  async extraireEtSauvegarder(
    documentId: string,
    userId: string,
  ): Promise<void> {
    // 1. Récupérer le document
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });

    if (!document) {
      throw new NotFoundException(`Document ${documentId} introuvable`);
    }

    // 2. Vérifier la catégorie
    const cat = (document.category ?? '').toUpperCase();
    if (!CATEGORIES_OCR.includes(cat)) {
      this.logger.log(`[OCR] Catégorie "${document.category}" → OCR ignoré`);
      return;
    }

    // 3. Trouver le chemin du fichier
    const uploadsDir = path.join(process.cwd(), 'uploads');
    const filename = path.basename(document.url);
    const filePath = path.join(uploadsDir, filename);

    if (!fs.existsSync(filePath)) {
      this.logger.error(`[OCR] Fichier introuvable : ${filePath}`);
      throw new NotFoundException(`Fichier introuvable : ${document.url}`);
    }

    // 4. Marquer comme "en cours"
    await this.prisma.document.update({
      where: { id: documentId },
      data: { extractedData: JSON.stringify({ statut: 'EN_COURS' }) },
    });

    try {
      // 5. Appeler le microservice Python
      const resultat = await this.appelerMicroservice(filePath);

      // 6. Sauvegarder dans Document.extractedData
      const extractedPayload = {
        statut: 'TERMINE',
        ...resultat,
        summary: this.genererResume(resultat),
      };

      await this.prisma.document.update({
        where: { id: documentId },
        data: { extractedData: JSON.stringify(extractedPayload) },
      });

      // 7. Créer / mettre à jour l'Invoice
      await this.sauvegarderInvoice(documentId, resultat);

      const confGlobale = resultat.global_confidence_score ?? 0;
      this.logger.log(
        `[OCR] ✅ Document ${documentId} extrait — confiance globale ${(confGlobale * 100).toFixed(1)}%`,
      );
    } catch (err) {
      // Extraction du message d'erreur réel de FastAPI si disponible
      let errorMessage = err.response?.data?.detail || err.message || 'Erreur inconnue';
      if (Array.isArray(errorMessage)) {
        errorMessage = errorMessage.map((e: any) => e.msg || JSON.stringify(e)).join(', ');
      } else if (typeof errorMessage === 'object') {
        errorMessage = JSON.stringify(errorMessage);
      }
      
      // En cas d'erreur, marquer le statut
      await this.prisma.document.update({
        where: { id: documentId },
        data: {
          extractedData: JSON.stringify({
            statut: 'ERREUR',
            message: errorMessage,
          }),
        },
      });
      throw err;
    }
  }

  /**
   * Appel HTTP vers le microservice Python FastAPI.
   */
  private async appelerMicroservice(
    cheminFichier: string,
  ): Promise<OcrResultatDto> {
    const form = new FormData();
    form.append('file', fs.createReadStream(cheminFichier), {
      filename: path.basename(cheminFichier),
    });

    const { data } = await firstValueFrom(
      this.http.post<OcrResultatDto>(
        `${OCR_SERVICE_URL}/extraire`,
        form,
        { headers: form.getHeaders() },
      ),
    );

    return data;
  }

  /**
   * Crée ou met à jour l'entrée Invoice à partir du résultat OCR.
   */
  private async sauvegarderInvoice(
    documentId: string,
    resultat: OcrResultatDto,
  ): Promise<void> {
    const existingInvoice = await this.prisma.invoice.findFirst({
      where: { documentId },
    });

    const invoiceData = {
      vendorName: resultat.fournisseur ?? null,
      invoiceNumber: resultat.numero_facture ?? null,
      invoiceDate: this.parseDate(resultat.date_emission),
      totalAmount: resultat.total_ttc ? parseFloat(resultat.total_ttc) : null,
      taxAmount: resultat.tva ? parseFloat(resultat.tva) : null,
      currency: resultat.devise ?? null,
      extractedData: JSON.stringify(resultat),
    };

    if (existingInvoice) {
      await this.prisma.invoice.update({
        where: { id: existingInvoice.id },
        data: invoiceData,
      });
    } else {
      await this.prisma.invoice.create({
        data: {
          documentId,
          ...invoiceData,
        },
      });
    }
  }

  /**
   * Parse les dates dans divers formats (JJ/MM/AAAA, AAAA-MM-JJ, etc.)
   */
  private parseDate(dateStr?: string | null): Date | null {
    if (!dateStr) return null;

    // Format JJ/MM/AAAA
    const frMatch = dateStr.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (frMatch) {
      const d = new Date(`${frMatch[3]}-${frMatch[2]}-${frMatch[1]}`);
      return isNaN(d.getTime()) ? null : d;
    }

    // Format AAAA-MM-JJ
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const d = new Date(dateStr);
      return isNaN(d.getTime()) ? null : d;
    }

    return null;
  }

  /**
   * Génère un résumé textuel des données extraites.
   */
  private genererResume(resultat: OcrResultatDto): string {
    const lines = [
      'FACTURE EXTRAITE',
      '-----------------',
      `N° Facture       : ${resultat.numero_facture || 'Non trouvé'}`,
      `Date             : ${resultat.date_emission || 'Non trouvé'}`,
      `Fournisseur      : ${resultat.fournisseur || 'Non trouvé'}`,
      `Client           : ${resultat.client || 'Non trouvé'}`,
      '',
      `Sous-total HT    : ${resultat.total_ht || 'Non trouvé'} ${resultat.devise || ''}`,
      `TVA              : ${resultat.tva || 'Non trouvé'} ${resultat.devise || ''}`,
      `TOTAL TTC        : ${resultat.total_ttc || 'Non trouvé'} ${resultat.devise || ''}`,
      '',
      `Articles         : ${resultat.lignes?.length || 0} ligne(s) extraite(s)`,
      `Confiance        : ${resultat.confiance || '0/4'}`,
      `Méthode          : ${resultat.methode || 'regex'}`,
      `Temps            : ${resultat.temps_traitement || 0}s`,
    ];
    return lines.join('\n');
  }

  /**
   * Envoie les corrections de l'utilisateur au pipeline ML pour le réentraînement.
   */
  async envoyerFeedback(documentId: string, annotations: Record<string, any>, texteBrut: string) {
    try {
      const payload = {
        texte_brut: texteBrut,
        annotations,
        metadata_json: { documentId }
      };

      await firstValueFrom(
        this.http.post(`${OCR_SERVICE_URL}/api/v1/ml/feedback`, payload)
      );

      this.logger.log(`[OCR ML] Feedback envoyé avec succès pour le document ${documentId}`);
    } catch (error) {
      this.logger.error(`[OCR ML] Erreur lors de l'envoi du feedback: ${error.message}`);
    }
  }

  /**
   * Lecture du résultat OCR (pour le polling frontend).
   */
  async obtenirResultat(documentId: string) {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
      select: { extractedData: true },
    });

    if (!document || !document.extractedData) {
      return { statut: 'PAS_ENCORE_EXTRAIT' };
    }

    try {
      const data = JSON.parse(document.extractedData);
      return data;
    } catch {
      return { statut: 'ERREUR', message: 'Données corrompues' };
    }
  }
}
