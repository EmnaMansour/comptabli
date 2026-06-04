import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('MessagingController (e2e)', () => {
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
    await prisma.conversationParticipant.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '-msg@comptabli.com' } } });

    const hashed = await bcrypt.hash('password123', 10);
    
    const admin = await prisma.user.create({ data: { email: 'admin-msg@comptabli.com', password: hashed, firstName: 'A', lastName: 'A', role: Role.ADMIN, status: Status.ACTIVE } });
    adminId = admin.id;

    const client = await prisma.user.create({ data: { email: 'client-msg@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.CLIENT, status: Status.ACTIVE } });
    clientId = client.id;

    const comptable = await prisma.user.create({ data: { email: 'comp-msg@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.COMPTABLE, status: Status.ACTIVE } });
    comptableId = comptable.id;
  });

  afterAll(async () => {
    await prisma.conversationParticipant.deleteMany();
    await prisma.message.deleteMany();
    await prisma.conversation.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: '-msg@comptabli.com' } } });
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

  describe('/messaging/conversations (POST)', () => {
    let conversationId: string;

    it('should create a conversation between client and accountant', async () => {
      const token = getValidToken(Role.CLIENT);
      const response = await request(app.getHttpServer())
        .post('/messaging/conversations')
        .set('Authorization', `Bearer ${token}`)
        .send({ userIds: [comptableId] })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.participants).toHaveLength(2);
      conversationId = response.body.id;
    });

    it('should throw 403 Forbidden for another user trying to read conversation', () => {
      const token = getValidToken(Role.ADMIN);
      return request(app.getHttpServer())
        .get(`/messaging/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(403);
    });

    it('should allow participant to send message', async () => {
      const token = getValidToken(Role.COMPTABLE);
      const response = await request(app.getHttpServer())
        .post(`/messaging/conversations/${conversationId}/messages`)
        .set('Authorization', `Bearer ${token}`)
        .send({ content: 'Hello Client' })
        .expect(201);

      expect(response.body.content).toBe('Hello Client');
    });

    it('should allow participant to read conversation with messages', async () => {
      const token = getValidToken(Role.CLIENT);
      const response = await request(app.getHttpServer())
        .get(`/messaging/conversations/${conversationId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.messages).toHaveLength(1);
      expect(response.body.messages[0].content).toBe('Hello Client');
    });
  });
});
