import { Controller, Get, UseGuards, Request } from '@nestjs/common';
import { StatsService } from './stats.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Role } from '@prisma/client';
import { Roles } from '../common/decorators/roles.decorator';

@Controller('stats')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class StatsController {
  constructor(private readonly statsService: StatsService) {}

  @Get('dashboard')
  getDashboardStats(@Request() req: any) {
    if (req.user.role === Role.CLIENT) {
      return this.statsService.getClientStats(req.user.userId);
    }
    if (req.user.role === Role.COMPTABLE) {
      return this.statsService.getAccountantStats(req.user.userId);
    }
    if (req.user.role === Role.COLLABORATEUR) {
      return this.statsService.getCollaboratorStats(req.user.userId);
    }
    if (req.user.role === Role.ADMIN) {
      return this.statsService.getAdminDashboardStats();
    }
    return { message: 'No stats available for this role' };
  }

  @Get('admin/dashboard')
  @Roles(Role.ADMIN)
  getAdminDashboard() {
    return this.statsService.getAdminDashboardStats();
  }

  @Get('admin/analytics')
  @Roles(Role.ADMIN)
  getAdminAnalytics() {
    return this.statsService.getAdminAnalytics();
  }
}
