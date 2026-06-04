import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  UseGuards,
  Request,
  UploadedFile,
  UseInterceptors,
  Body,
  Query,
} from '@nestjs/common';
import { DocumentsService } from './documents.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { Express } from 'express';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('documents')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  findAll(
    @Request() req: RequestWithUser,
    @Query('folderId') folderId?: string,
    @Query('archived') archived?: string,
    @Query('clientId') clientId?: string,
  ) {
    const archivedOnly = archived === 'true' || archived === '1';
    return this.documentsService.findAll(req.user.userId, req.user.role, folderId, archivedOnly, clientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.documentsService.findOne(id, req.user.userId, req.user.role);
  }

  @Post(':id/comments')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR)
  addComment(
    @Param('id') id: string,
    @Body('content') content: string,
    @Request() req: RequestWithUser,
  ) {
    if (!content || content.trim().length === 0) {
      throw new BadRequestException('Le commentaire ne peut pas être vide');
    }
    return this.documentsService.addComment(id, req.user.userId, content);
  }

  @Post('upload')
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
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR)
  upload(
    @UploadedFile() file: Express.Multer.File,
    @Body('clientId') clientId: string,
    @Body('folderId') folderId: string,
    @Body('name') name: string | undefined,
    @Body('category') category: string | undefined,
    @Request() req: RequestWithUser,
  ) {
    return this.documentsService.upload(file, clientId, req.user.userId, req.user.role, folderId, name, category);
  }

  @Post(':id/annotate')
  @Roles(Role.COMPTABLE, Role.COLLABORATEUR)
  annotate(
    @Param('id') id: string,
    @Body() body: { content: string; page: number; position: string },
    @Request() req: RequestWithUser,
  ) {
    return this.documentsService.annotate(id, body.content, body.page, body.position, req.user.userId);
  }

  @Patch(':id')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR)
  patchDocument(
    @Param('id') id: string,
    @Body() body: { archived?: boolean; name?: string; folderId?: string | null },
    @Request() req: RequestWithUser,
  ) {
    const hasArchived = typeof body.archived === 'boolean';
    const hasName = typeof body.name === 'string' && body.name.trim().length > 0;
    const hasFolderId = body.folderId !== undefined;

    if (!hasArchived && !hasName && !hasFolderId) {
      throw new BadRequestException('Indiquez archived, name ou folderId');
    }

    return this.documentsService.patchDocument(id, req.user.userId, req.user.role, {
      ...(hasArchived ? { archived: body.archived } : {}),
      ...(hasName ? { name: body.name!.trim() } : {}),
      ...(hasFolderId ? { folderId: body.folderId } : {}),
    });
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.documentsService.remove(id, req.user.userId, req.user.role);
  }
}