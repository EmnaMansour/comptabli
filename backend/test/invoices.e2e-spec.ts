import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('InvoicesController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminId: string;
  let clientId: string;
  let comptableId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();

    jwtService = app.get<JwtService>(JwtService);
    prisma = app.get<PrismaService>(PrismaService);

    // Pre-cleanup: ensure no leftover data from previous failed runs
    await prisma.user.deleteMany({ where: { email: { contains: '-inv-e2e@comptabli.com' } } });

    const hashed = await bcrypt.hash('password123', 10);
    const admin = await prisma.user.create({
      data: { email: 'admin-inv-e2e@comptabli.com', password: hashed, firstName: 'A', lastName: 'A', role: Role.ADMIN, status: Status.ACTIVE }
    });
    adminId = admin.id;

    const client = await prisma.user.create({
      data: { email: 'client-inv-e2e@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.CLIENT, status: Status.ACTIVE }
    });
    clientId = client.id;

    const comptable = await prisma.user.create({
      data: { email: 'comp-inv-e2e@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.COMPTABLE, status: Status.ACTIVE }
    });
    comptableId = comptable.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: '-inv-e2e@comptabli.com' } } });
    await prisma.$disconnect();
    await app.close();
  });

  const getValidToken = (role: Role, customId?: string) => {
    let id = adminId;
    if (role === Role.CLIENT) id = clientId;
    if (role === Role.COMPTABLE) id = comptableId;
    if (customId) id = customId;
    return jwtService.sign({ sub: id, email: 'test@comptabli.com', role });
  };

  describe('/invoices (GET)', () => {
    it('should return 401 if no token is provided', () => {
      return request(app.getHttpServer())
        .get('/invoices')
        .expect(401);
    });

    it('should allow CLIENT to access invoices', () => {
      const token = getValidToken(Role.CLIENT);
      return request(app.getHttpServer())
        .get('/invoices')
        .set('Authorization', `Bearer ${token}`)
        // It might return 200 [] if DB is empty
        .expect(200); 
    });
  });

  describe('/invoices/:id (GET)', () => {
    it('should return 404 for non-existent invoice', () => {
      const token = getValidToken(Role.COMPTABLE);
      return request(app.getHttpServer())
        .get('/invoices/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('/invoices/corrections (POST)', () => {
    it('should return 400 if missing fields are provided', () => {
      const token = getValidToken(Role.COMPTABLE);
      return request(app.getHttpServer())
        .post('/invoices/123e4567-e89b-12d3-a456-426614174000/corrections')
        .set('Authorization', `Bearer ${token}`)
        .send({
          // Missing invoiceId, field, newValue
        })
        .expect(400);
    });
  });
});
