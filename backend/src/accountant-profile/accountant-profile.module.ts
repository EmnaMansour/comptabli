import { Module } from '@nestjs/common';
import { AccountantProfileService } from './accountant-profile.service';
import { AccountantProfileController } from './accountant-profile.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [PrismaModule, NotificationsModule],
  providers: [AccountantProfileService],
  controllers: [AccountantProfileController],
  exports: [AccountantProfileService],
})
export class AccountantProfileModule {}
