import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Delete,
  UseGuards,
  Query,
  Request,
} from '@nestjs/common';
import { FoldersService } from './folders.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';
import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsOptional()
  parentId?: string;

  @IsString()
  @IsOptional()
  clientId?: string;
}

export class UpdateFolderDto {
  @IsString()
  @IsNotEmpty()
  name: string;
}

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('folders')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class FoldersController {
  constructor(private readonly foldersService: FoldersService) {}

  @Post()
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  create(@Body() createFolderDto: CreateFolderDto, @Request() req: RequestWithUser) {
    return this.foldersService.create(
      createFolderDto.name, 
      req.user.userId, 
      req.user.role,
      createFolderDto.parentId,
      createFolderDto.clientId
    );
  }

  @Get()
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  findAll(
    @Request() req: RequestWithUser,
    @Query('parentId') parentId?: string,
    @Query('clientId') clientId?: string,
    @Query('archived') archived?: string,
  ) {
    const isArchived = archived === 'true';
    return this.foldersService.findAll(req.user.userId, req.user.role, parentId, clientId, isArchived);
  }

  @Patch(':id/archive-status')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  updateArchiveStatus(
    @Param('id') id: string,
    @Body('archived') archived: boolean,
    @Request() req: RequestWithUser,
  ) {
    return this.foldersService.updateArchivedRecursive(id, req.user.userId, req.user.role, archived);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.foldersService.findOne(id, req.user.userId, req.user.role);
  }

  @Patch(':id')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateFolderDto, @Request() req: RequestWithUser) {
    return this.foldersService.updateName(id, req.user.userId, req.user.role, dto.name);
  }

  @Post(':id/archive-documents')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  archiveDocuments(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.foldersService.archiveAllDocumentsInFolder(id, req.user.userId, req.user.role);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.COMPTABLE, Role.COLLABORATEUR, Role.ADMIN)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.foldersService.remove(id, req.user.userId, req.user.role);
  }
}
