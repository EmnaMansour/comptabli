import { Controller, Get, UseGuards } from '@nestjs/common';
import { StatsService } from '../stats/stats.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

@Controller('admin/analytics')
@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles(Role.ADMIN)
export class AdminAnalyticsController {
  constructor(private readonly statsService: StatsService) {}

  @Get()
  getAnalytics() {
    return this.statsService.getAdminAnalytics();
  }
}
