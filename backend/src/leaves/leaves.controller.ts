import { Controller, Get, Post, Delete, Body, Param, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { LeavesService } from './leaves.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('leaves')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class LeavesController {
  constructor(private readonly leavesService: LeavesService) {}

  @Post()
  @Roles(Role.COMPTABLE)
  create(@Body() body: any, @Request() req: any) {
    const startDate = new Date(body.startDate);
    let endDate = new Date(body.endDate);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new BadRequestException('Dates invalides');
    }
    
    // Make endDate cover the entire day (up to 23:59:59)
    endDate.setHours(23, 59, 59, 999);

    if (endDate < startDate) {
      throw new BadRequestException('La date de fin ne peut pas précéder la date de début');
    }

    return this.leavesService.create({
      accountantId: req.user.userId,
      startDate,
      endDate,
      reason: body.reason,
    });
  }

  @Get()
  @Roles(Role.COMPTABLE)
  findAll(@Request() req: any) {
    return this.leavesService.findAllByAccountant(req.user.userId);
  }

  @Delete(':id')
  @Roles(Role.COMPTABLE)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.leavesService.remove(id, req.user.userId);
  }
}
