import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('DocumentsController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminId: string;
  let client1Id: string;
  let client2Id: string;
  let doc1Id: string;

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
    await prisma.document.deleteMany({ where: { client: { email: { contains: '-doc@comptabli.com' } } } });
    await prisma.user.deleteMany({ where: { email: { contains: '-doc@comptabli.com' } } });

    const hashed = await bcrypt.hash('password123', 10);
    
    const admin = await prisma.user.create({ data: { email: 'admin-doc@comptabli.com', password: hashed, firstName: 'A', lastName: 'A', role: Role.ADMIN, status: Status.ACTIVE } });
    adminId = admin.id;

    const client1 = await prisma.user.create({ data: { email: 'c1-doc@comptabli.com', password: hashed, firstName: 'C1', lastName: 'C1', role: Role.CLIENT, status: Status.ACTIVE } });
    client1Id = client1.id;

    const client2 = await prisma.user.create({ data: { email: 'c2-doc@comptabli.com', password: hashed, firstName: 'C2', lastName: 'C2', role: Role.CLIENT, status: Status.ACTIVE } });
    client2Id = client2.id;

    const doc = await prisma.document.create({
      data: {
        name: 'Facture Client 1',
        clientId: client1Id,
        url: '/uploads/fake.pdf',
        type: 'application/pdf',
        size: 1024,
      }
    });
    doc1Id = doc.id;
  });

  afterAll(async () => {
    await prisma.document.deleteMany({});
    await prisma.user.deleteMany({ where: { email: { contains: '-doc@comptabli.com' } } });
    await prisma.$disconnect();
    await app.close();
  });

  const getValidToken = (role: Role, customId?: string) => {
    let id = adminId;
    if (customId) id = customId;
    return jwtService.sign({ sub: id, email: 'test@comptabli.com', role });
  };

  describe('/documents (GET)', () => {
    it('should allow CLIENT 1 to see their own document', async () => {
      const token = getValidToken(Role.CLIENT, client1Id);
      const response = await request(app.getHttpServer())
        .get('/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
      expect(response.body[0].id).toBe(doc1Id);
    });

    it('should NOT allow CLIENT 2 to see CLIENT 1 document', async () => {
      const token = getValidToken(Role.CLIENT, client2Id);
      const response = await request(app.getHttpServer())
        .get('/documents')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(0);
    });
  });

  describe('/documents/:id (GET)', () => {
    it('should allow CLIENT 1 to fetch their own document by ID', async () => {
      const token = getValidToken(Role.CLIENT, client1Id);
      const response = await request(app.getHttpServer())
        .get(`/documents/${doc1Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.id).toBe(doc1Id);
    });

    it('should throw 403 or 404 when CLIENT 2 fetches CLIENT 1 document by ID', async () => {
      const token = getValidToken(Role.CLIENT, client2Id);
      // DocumentService throws ForbiddenException ('Accès refusé au document')
      return request(app.getHttpServer())
        .get(`/documents/${doc1Id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });
  });
});
