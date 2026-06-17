import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { PrismaModule } from './prisma/prisma.module';
import { MailModule } from './mail/mail.module';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { DocumentsModule } from './documents/documents.module';
import { TasksModule } from './tasks/tasks.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FoldersModule } from './folders/folders.module';
import { RequestsModule } from './requests/requests.module';
import { MeetingsModule } from './meetings/meetings.module';
import { MessagingModule } from './messaging/messaging.module';
import { InvoicesModule } from './invoices/invoices.module';
import { StatsModule } from './stats/stats.module';
import { NotificationsModule } from './notifications/notifications.module';
import { ReviewsModule } from './reviews/reviews.module';
import { AuditLogModule } from './audit-logs/audit-log.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { AdminModule } from './admin/admin.module';
import { CronModule } from './cron/cron.module';
import { LeavesModule } from './leaves/leaves.module';
import { AccountantProfileModule } from './accountant-profile/accountant-profile.module';
import { AiModule } from './ai/ai.module';
import { OcrModule } from './ocr/ocr.module';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
    }),
    ConfigModule.forRoot({ isGlobal: true }),
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'uploads'),
      serveRoot: '/uploads',
    }),
    PrismaModule,
    MailModule,
    UsersModule,
    AuthModule,
    DocumentsModule,
    TasksModule,
    FoldersModule,
    RequestsModule,
    MeetingsModule,
    MessagingModule,
    InvoicesModule,
    StatsModule,
    NotificationsModule,
    ReviewsModule,
    AccountantProfileModule,
    AuditLogModule,
    OrganizationsModule,
    AdminModule,
    CronModule,
    LeavesModule,
    AiModule,
    OcrModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
