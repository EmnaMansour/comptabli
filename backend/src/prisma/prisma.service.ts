import 'dotenv/config';
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { PrismaClient, Prisma, Role, Status } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      console.error('CRITICAL: DATABASE_URL is not defined in .env file!');
    }
    const adapter = new PrismaPg({ connectionString: connectionString ?? '' });
    super({ adapter });
  }

  async onModuleInit() {
    await this.$connect();
    await this.seedAdmin();
  }

  private async seedAdmin() {
    const email = process.env.ADMIN_EMAIL?.trim()?.toLowerCase();
    const plainPassword = process.env.ADMIN_PASSWORD;

    if (!email || !plainPassword) {
      this.logger.warn(
        'ADMIN_EMAIL ou ADMIN_PASSWORD non défini. Le compte admin auto ne sera pas créé.',
      );
      return;
    }

    try {
      const existingAdmin = await this.user.findUnique({
        where: { email },
      });

      if (!existingAdmin) {
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        await this.user.create({
          data: {
            email,
            password: hashedPassword,
            firstName: 'Admin',
            lastName: 'Système',
            role: Role.ADMIN,
            status: Status.ACTIVE,
          },
        });
        this.logger.log(
          `Compte administrateur créé automatiquement : ${email}`,
        );
      } else {
        // Optionnel: s'assurer qu'il a bien le rôle admin
        if (
          existingAdmin.role !== Role.ADMIN ||
          existingAdmin.status !== Status.ACTIVE
        ) {
          await this.user.update({
            where: { email },
            data: { role: Role.ADMIN, status: Status.ACTIVE },
          });
          this.logger.log(`Profil admin mis à jour pour : ${email}`);
        }
      }
    } catch (e) {
      this.logger.error('Erreur lors de la création du compte admin', e);
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
