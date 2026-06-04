import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { RequestsService } from './requests.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';
import { Express } from 'express';

@Controller('requests')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class RequestsController {
  constructor(private readonly requestsService: RequestsService) {}

  @Post()
  @Roles(Role.CLIENT, Role.ADMIN)
  async create(@Body() body: any, @Request() req: any) {
    try {
      const dueDate =
        body.dueDate != null && body.dueDate !== ''
          ? new Date(body.dueDate)
          : undefined;
      const desiredResponseAt =
        body.desiredResponseAt != null && body.desiredResponseAt !== ''
          ? new Date(body.desiredResponseAt)
          : undefined;

      // Determine target client
      let targetClientId = req.user.userId;
      if (req.user.role !== Role.CLIENT) {
        if (!body.clientId) {
          throw new Error('clientId is required for staff-initiated requests');
        }
        targetClientId = body.clientId;
      }

      return await this.requestsService.create({
        type: body.type,
        subject: body.subject ?? null,
        description: body.description ?? '',
        urgency: body.urgency ?? 'NORMAL',
        accountantId: body.accountantId ?? null,
        dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : undefined,
        desiredResponseAt:
          desiredResponseAt && !Number.isNaN(desiredResponseAt.getTime())
            ? desiredResponseAt
            : undefined,
        clientId: targetClientId,
        creatorId: req.user.userId,
      });
    } catch (err: any) {
      console.error('Error creating request:', err);
      throw new BadRequestException(
        `Erreur lors de la création de la demande: ${err?.message || 'Unknown error'}`
      );
    }
  }

  @Get()
  findAll(@Request() req: any, @Query('clientId') clientId?: string) {
    return this.requestsService.findAll(req.user.userId, req.user.role, clientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: any) {
    return this.requestsService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id/management')
  @Roles(Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  updateManagement(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const respondedAt =
      body.respondedAt === null
        ? null
        : body.respondedAt != null && body.respondedAt !== ''
          ? new Date(body.respondedAt)
          : undefined;
    const dueDate =
      body.dueDate === null
        ? null
        : body.dueDate != null && body.dueDate !== ''
          ? new Date(body.dueDate)
          : undefined;

    return this.requestsService.updateManagement(id, req.user.userId, req.user.role, {
      accountantId: body.accountantId,
      subject: body.subject,
      type: body.type,
      description: body.description,
      dueDate: dueDate && !Number.isNaN(dueDate.getTime()) ? dueDate : dueDate === null ? null : undefined,
      respondedAt:
        respondedAt === null
          ? null
          : respondedAt && !Number.isNaN(respondedAt.getTime())
            ? respondedAt
            : undefined,
    });
  }

  @Patch(':id/status')
  @Roles(Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  updateStatus(@Param('id') id: string, @Body('status') status: Status, @Request() req: any) {
    return this.requestsService.updateStatus(id, req.user.userId, req.user.role, status);
  }

  @Patch(':id')
  @Roles(Role.CLIENT)
  updateOwn(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    const dueDate =
      body.dueDate === null
        ? null
        : body.dueDate != null && body.dueDate !== ''
          ? new Date(body.dueDate)
          : undefined;
    const desiredResponseAt =
      body.desiredResponseAt === null
        ? null
        : body.desiredResponseAt != null && body.desiredResponseAt !== ''
          ? new Date(body.desiredResponseAt)
          : undefined;
    return this.requestsService.updateOwn(id, req.user.userId, {
      type: body.type,
      subject: body.subject,
      description: body.description,
      urgency: body.urgency,
      accountantId: body.accountantId,
      dueDate:
        dueDate === null
          ? null
          : dueDate && !Number.isNaN(dueDate.getTime())
            ? dueDate
            : undefined,
      desiredResponseAt:
        desiredResponseAt === null
          ? null
          : desiredResponseAt && !Number.isNaN(desiredResponseAt.getTime())
            ? desiredResponseAt
            : undefined,
    });
  }

  @Post(':id/comments')
  addComment(@Param('id') id: string, @Body('content') content: string, @Request() req: any) {
    return this.requestsService.addComment(id, req.user.userId, req.user.role, content);
  }

  @Post(':id/attachments/from-document')
  @Roles(Role.CLIENT)
  addAttachmentFromDocument(
    @Param('id') id: string,
    @Body('documentId') documentId: string,
    @Request() req: any,
  ) {
    return this.requestsService.addAttachmentFromDocument(
      id,
      req.user.userId,
      req.user.role,
      documentId,
    );
  }

  @Post(':id/attachments')
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
  addAttachment(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Request() req: any,
  ) {
    if (!file) {
      throw new BadRequestException('Aucun fichier reçu');
    }
    return this.requestsService.addAttachment(id, req.user.userId, req.user.role, file);
  }

  @Delete(':id/attachments/:attachmentId')
  removeAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Request() req: any,
  ) {
    return this.requestsService.removeAttachment(id, attachmentId, req.user.userId, req.user.role);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Request() req: any) {
    return this.requestsService.remove(id, req.user.userId, req.user.role);
  }
}
