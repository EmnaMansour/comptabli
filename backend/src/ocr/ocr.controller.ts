import {
  Controller,
  Param,
  Post,
  Get,
  UseGuards,
  Request,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { OcrService } from './ocr.service';

@Controller('ocr')
@UseGuards(AuthGuard('jwt'))
export class OcrController {
  constructor(private readonly ocrService: OcrService) {}

  /**
   * Lance l'extraction OCR sur un document déjà importé.
   * POST /ocr/extraire/:documentId
   */
  @Post('extraire/:documentId')
  @HttpCode(202)
  async extraire(
    @Param('documentId') documentId: string,
    @Request() req: any,
  ) {
    // Lance l'extraction en arrière-plan (ne bloque pas la réponse)
    this.ocrService
      .extraireEtSauvegarder(documentId, req.user.userId)
      .catch((err) =>
        console.error(`[OCR] Erreur document ${documentId}:`, err.message),
      );

    return { message: 'Extraction OCR lancée', documentId };
  }

  /**
   * Récupère le résultat OCR d'un document.
   * GET /ocr/resultat/:documentId
   */
  @Get('resultat/:documentId')
  async resultat(@Param('documentId') documentId: string) {
    return this.ocrService.obtenirResultat(documentId);
  }
}
