import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  UseGuards,
  Request,
  Query,
  HttpCode,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Express } from 'express';
import { AccountantProfileService } from './accountant-profile.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('accountant-profile')
export class AccountantProfileController {
  constructor(private readonly accountantProfileService: AccountantProfileService) {}

  // ─── PUBLIC ROUTES (no auth) ──────────────────────────────────

  /**
   * Liste tous les comptables et leurs fiches networking (PUBLIC)
   */
  @Get()
  async listProfiles(@Query('specialty') specialty?: string, @Query('location') location?: string) {
    return this.accountantProfileService.listAllProfiles({
      specialty,
      location,
    });
  }

  /**
   * Récupère le profil public d'un comptable par ID (PUBLIC)
   */
  @Get('public/:accountantId')
  async getPublicProfile(@Param('accountantId') accountantId: string) {
    return this.accountantProfileService.getProfile(accountantId);
  }

  /**
   * Récupère les avis d'un comptable (PUBLIC)
   */
  @Get(':accountantId/reviews')
  async getReviews(@Param('accountantId') accountantId: string) {
    return this.accountantProfileService.getReviews(accountantId);
  }

  /**
   * Envoyer une demande de contact à un comptable (PUBLIC - pour les visiteurs)
   */
  @Post('public/:accountantId/contact')
  @HttpCode(201)
  async sendVisitorContact(
    @Param('accountantId') accountantId: string,
    @Body() visitorData: {
      name: string;
      email: string;
      phone: string;
      company: string;
      subject: string;
      message: string;
    },
  ) {
    return this.accountantProfileService.receiveVisitorContact(
      accountantId,
      visitorData,
    );
  }

  // ─── AUTHENTICATED ROUTES ─────────────────────────────────────

  /**
   * Récupère ou crée le profil networking du comptable connecté
   */
  @Get('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  async getMyProfile(@Request() req: any) {
    return this.accountantProfileService.ensureProfileExists(req.user.userId || req.user.id);
  }

  /**
   * Récupère les contacts reçus par le comptable
   */
  @Get('me/contacts')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  async getMyContacts(@Request() req: any) {
    return this.accountantProfileService.getReceivedContacts(req.user.userId || req.user.id);
  }

  /**
   * Récupère les comptables liés au client actuel
   */
  @Get('me/my-accountants')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  async getMyAccountants(@Request() req: any) {
    return this.accountantProfileService.getMyAccountants(req.user.userId || req.user.id);
  }

  /**
   * Vérifie si le client actuel a une relation active avec un comptable
   */
  @Get(':accountantId/has-relationship')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  async checkRelationship(
    @Param('accountantId') accountantId: string,
    @Request() req: any,
  ) {
    return this.accountantProfileService.checkClientRelationship(
      accountantId,
      req.user.userId || req.user.id,
    );
  }

  /**
   * Met à jour le profil networking
   */
  @Put('me')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  async updateMyProfile(@Request() req: any, @Body() updateData: any) {
    return this.accountantProfileService.updateProfile(req.user.userId || req.user.id, updateData);
  }

  /**
   * Récupère le modèle de dossiers personnalisé
   */
  @Get('me/folder-template')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  async getMyFolderTemplate(@Request() req: any) {
    return this.accountantProfileService.getFolderTemplate(req.user.userId || req.user.id);
  }

  /**
   * Met à jour le modèle de dossiers personnalisé
   */
  @Put('me/folder-template')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  async updateMyFolderTemplate(@Request() req: any, @Body('template') template: string) {
    return this.accountantProfileService.updateFolderTemplate(req.user.userId || req.user.id, template);
  }

  /**
   * Upload un fichier pour le profil comptable
   */
  @Post('me/upload')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (_req, file, callback) => {
          const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
          const timestamp = Date.now();
          const fileExt = extname(file.originalname);
          callback(null, `${timestamp}-${safeName}${fileExt}`);
        },
      }),
    }),
  )
  async uploadFile(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Aucun fichier fourni');
    }
    return { url: `/uploads/${file.filename}` };
  }

  /**
   * Envoyer une demande de contact à un comptable
   */
  @Post(':accountantId/contact')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.CLIENT)
  @HttpCode(201)
  async sendContact(
    @Param('accountantId') accountantId: string,
    @Request() req: any,
    @Body('message') message: string,
  ) {
    return this.accountantProfileService.receiveContact(
      accountantId,
      req.user.userId || req.user.id,
      message,
    );
  }

  /**
   * Marquer un contact comme lu
   */
  @Put('contacts/:contactId/read')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles(Role.COMPTABLE)
  async markAsRead(@Param('contactId') contactId: string) {
    return this.accountantProfileService.markContactAsRead(contactId);
  }
}
