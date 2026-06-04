import { Controller, Get, Patch, Param, Body, UseGuards } from '@nestjs/common';
import { OrganizationsService } from '../organizations/organizations.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/storage')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminStorageController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  @Get()
  findAll() {
    return this.organizationsService.findAllAdmin();
  }

  @Patch(':organizationId/quota')
  updateQuota(@Param('organizationId') organizationId: string, @Body('limit') limit: number) {
    return this.organizationsService.updateQuota(organizationId, limit);
  }
}
