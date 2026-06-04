import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { OrganizationsService } from './organizations.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('organizations')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get('admin/all')
  @Roles(Role.ADMIN)
  findAllAdmin() {
    return this.organizationsService.findAllAdmin();
  }

  @Patch('admin/:id/quota')
  @Roles(Role.ADMIN)
  updateQuota(@Param('id') id: string, @Body('storageLimit') storageLimit: number) {
    return this.organizationsService.updateQuota(id, storageLimit);
  }
}
