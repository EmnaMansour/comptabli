import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('UsersController (e2e)', () => {
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
    await prisma.user.deleteMany({ where: { email: { in: ['admin-e2e@comptabli.com', 'client-e2e@comptabli.com', 'comp-e2e@comptabli.com'] } } });

    const hashed = await bcrypt.hash('password123', 10);
    const admin = await prisma.user.create({
      data: { email: 'admin-e2e@comptabli.com', password: hashed, firstName: 'A', lastName: 'A', role: Role.ADMIN, status: Status.ACTIVE }
    });
    adminId = admin.id;

    const client = await prisma.user.create({
      data: { email: 'client-e2e@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.CLIENT, status: Status.ACTIVE }
    });
    clientId = client.id;

    const comptable = await prisma.user.create({
      data: { email: 'comp-e2e@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.COMPTABLE, status: Status.ACTIVE }
    });
    comptableId = comptable.id;
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { in: ['admin-e2e@comptabli.com', 'client-e2e@comptabli.com', 'comp-e2e@comptabli.com'] } } });
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

  describe('/users/collaborators (POST)', () => {
    it('should return 401 if no token provided', () => {
      return request(app.getHttpServer())
        .post('/users/collaborators')
        .send({})
        .expect(401);
    });

    it('should return 403 Forbidden if role is CLIENT', () => {
      const token = getValidToken(Role.CLIENT);
      return request(app.getHttpServer())
        .post('/users/collaborators')
        .set('Authorization', `Bearer ${token}`)
        .send({})
        .expect(403);
    });

    it('should return 400 Bad Request if validation fails for COMPTABLE', () => {
      const token = getValidToken(Role.COMPTABLE);
      return request(app.getHttpServer())
        .post('/users/collaborators')
        .set('Authorization', `Bearer ${token}`)
        .send({}) // Missing required DTO fields like email, firstName
        .expect(400);
    });
  });

  describe('/users/me (GET)', () => {
    it('should return 401 if no token provided', () => {
      return request(app.getHttpServer())
        .get('/users/me')
        .expect(401);
    });

    it('should return 401 if user does not exist in DB (even with valid token)', () => {
      const token = getValidToken(Role.CLIENT, 'non-existent-id');
      return request(app.getHttpServer())
        .get('/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(401);
    });
  });
  
  describe('/users/:id (GET)', () => {
    it('should return 404 if requested user ID is invalid/not found', () => {
      const token = getValidToken(Role.COMPTABLE);
      return request(app.getHttpServer())
        .get('/users/123e4567-e89b-12d3-a456-426614174000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
