import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('LeavesController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let comptableId: string;
  let clientId: string;
  let leaveId: string;

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
    await prisma.accountantLeave.deleteMany({ where: { accountant: { email: { contains: '-leaves@comptabli.com' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: '-leaves@comptabli.com' } } });

    const hashed = await bcrypt.hash('password123', 10);

    const comptable = await prisma.user.create({
      data: { email: 'comp-leaves@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.COMPTABLE, status: Status.ACTIVE }
    });
    comptableId = comptable.id;

    const client = await prisma.user.create({
      data: { email: 'client-leaves@comptabli.com', password: hashed, firstName: 'Cl', lastName: 'Cl', role: Role.CLIENT, status: Status.ACTIVE }
    });
    clientId = client.id;
  });

  afterAll(async () => {
    await prisma.accountantLeave.deleteMany({ where: { accountantId: comptableId } });
    await prisma.user.deleteMany({ where: { email: { contains: '-leaves@comptabli.com' } } });
    await prisma.$disconnect();
    await app.close();
  });

  const getToken = (role: Role, customId?: string) => {
    const id = customId ?? (role === Role.COMPTABLE ? comptableId : clientId);
    return jwtService.sign({ sub: id, email: 'test@comptabli.com', role });
  };

  describe('POST /leaves', () => {
    it('should return 403 for a CLIENT', () => {
      return request(app.getHttpServer())
        .post('/leaves')
        .set('Authorization', `Bearer ${getToken(Role.CLIENT)}`)
        .send({ startDate: '2025-08-01', endDate: '2025-08-15', reason: 'Vacances' })
        .expect(403);
    });

    it('should return 400 for invalid dates', () => {
      return request(app.getHttpServer())
        .post('/leaves')
        .set('Authorization', `Bearer ${getToken(Role.COMPTABLE)}`)
        .send({ startDate: 'not-a-date', endDate: '2025-08-15' })
        .expect(400);
    });

    it('should return 400 if endDate is before startDate', () => {
      return request(app.getHttpServer())
        .post('/leaves')
        .set('Authorization', `Bearer ${getToken(Role.COMPTABLE)}`)
        .send({ startDate: '2025-08-15', endDate: '2025-08-01' })
        .expect(400);
    });

    it('should allow COMPTABLE to create a leave', async () => {
      const response = await request(app.getHttpServer())
        .post('/leaves')
        .set('Authorization', `Bearer ${getToken(Role.COMPTABLE)}`)
        .send({ startDate: '2025-08-01', endDate: '2025-08-15', reason: 'Vacances été' })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.accountantId).toBe(comptableId);
      leaveId = response.body.id;
    });
  });

  describe('GET /leaves', () => {
    it('should return 403 for a CLIENT', () => {
      return request(app.getHttpServer())
        .get('/leaves')
        .set('Authorization', `Bearer ${getToken(Role.CLIENT)}`)
        .expect(403);
    });

    it('should return the list of leaves for the COMPTABLE', async () => {
      const response = await request(app.getHttpServer())
        .get('/leaves')
        .set('Authorization', `Bearer ${getToken(Role.COMPTABLE)}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('DELETE /leaves/:id', () => {
    it('should return 403 for a CLIENT trying to delete', () => {
      return request(app.getHttpServer())
        .delete(`/leaves/${leaveId}`)
        .set('Authorization', `Bearer ${getToken(Role.CLIENT)}`)
        .expect(403);
    });

    it('should return 404 for a non-existent leave ID', () => {
      return request(app.getHttpServer())
        .delete('/leaves/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${getToken(Role.COMPTABLE)}`)
        .expect(404);
    });

    it('should allow COMPTABLE to delete their own leave', async () => {
      await request(app.getHttpServer())
        .delete(`/leaves/${leaveId}`)
        .set('Authorization', `Bearer ${getToken(Role.COMPTABLE)}`)
        .expect(200);
    });
  });
});
