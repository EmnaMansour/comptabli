import { Module } from '@nestjs/common';
import { AdminUsersController } from './admin-users.controller';
import { AdminAccountantsController } from './admin-accountants.controller';
import { AdminDashboardController } from './admin-dashboard.controller';
import { AdminAnalyticsController } from './admin-analytics.controller';
import { AdminReviewsController } from './admin-reviews.controller';
import { AdminStorageController } from './admin-storage.controller';
import { AdminAuditLogsController } from './admin-audit-logs.controller';
import { AdminProfileController } from './admin-profile.controller';

import { UsersModule } from '../users/users.module';
import { StatsModule } from '../stats/stats.module';
import { ReviewsModule } from '../reviews/reviews.module';
import { AuditLogModule } from '../audit-logs/audit-log.module';
import { OrganizationsModule } from '../organizations/organizations.module';

@Module({
  imports: [
    UsersModule,
    StatsModule,
    ReviewsModule,
    AuditLogModule,
    OrganizationsModule,
  ],
  controllers: [
    AdminUsersController,
    AdminAccountantsController,
    AdminDashboardController,
    AdminAnalyticsController,
    AdminReviewsController,
    AdminStorageController,
    AdminAuditLogsController,
    AdminProfileController,
  ],
})
export class AdminModule {}
