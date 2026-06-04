import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Query, Request } from '@nestjs/common';
import { InvoicesService } from './invoices.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';

@Controller('invoices')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Post()
  @Roles(Role.COMPTABLE, Role.ADMIN, Role.CLIENT)
  create(@Body() body: any) {
    return this.invoicesService.create(body);
  }

  @Get()
  findAll(@Query('clientId') clientId?: string) {
    return this.invoicesService.findAll(clientId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoicesService.findOne(id);
  }

  @Patch(':id')
  @Roles(Role.COMPTABLE, Role.ADMIN)
  update(@Param('id') id: string, @Body() body: any) {
    return this.invoicesService.update(id, body);
  }

  @Post(':id/corrections')
  @Roles(Role.COMPTABLE, Role.ADMIN)
  addCorrection(@Param('id') id: string, @Body() body: any, @Request() req: any) {
    return this.invoicesService.addCorrection(id, req.user.userId, body.field, body.oldValue, body.newValue);
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  remove(@Param('id') id: string) {
    return this.invoicesService.remove(id);
  }
}
