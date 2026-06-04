import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { JwtService } from '@nestjs/jwt';
import { Role, Status } from '@prisma/client';
import { PrismaService } from './../src/prisma/prisma.service';
import * as bcrypt from 'bcrypt';

describe('TasksController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let prisma: PrismaService;
  let adminId: string;
  let comptableId: string;
  let collaborateurId: string;
  let clientId: string;
  let orgId: string;

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
    await prisma.task.deleteMany({});
    await prisma.organization.deleteMany({ where: { name: 'Cabinet Test E2E' } });
    await prisma.user.deleteMany({ where: { email: { contains: '-tasks@comptabli.com' } } });

    const hashed = await bcrypt.hash('password123', 10);

    const admin = await prisma.user.create({ data: { email: 'admin-tasks@comptabli.com', password: hashed, firstName: 'A', lastName: 'A', role: Role.ADMIN, status: Status.ACTIVE } });
    adminId = admin.id;

    const comptable = await prisma.user.create({ data: { email: 'comp-tasks@comptabli.com', password: hashed, firstName: 'C', lastName: 'C', role: Role.COMPTABLE, status: Status.ACTIVE } });
    comptableId = comptable.id;

    const collaborateur = await prisma.user.create({ data: { email: 'collab-tasks@comptabli.com', password: hashed, firstName: 'L', lastName: 'L', role: Role.COLLABORATEUR, status: Status.ACTIVE } });
    collaborateurId = collaborateur.id;

    const client = await prisma.user.create({ data: { email: 'client-tasks@comptabli.com', password: hashed, firstName: 'Cl', lastName: 'Cl', role: Role.CLIENT, status: Status.ACTIVE } });
    clientId = client.id;

    // Create a real organization linked to the comptable
    const org = await prisma.organization.create({ data: { name: 'Cabinet Test E2E', ownerId: comptableId } });
    orgId = org.id;
  });

  afterAll(async () => {
    await prisma.task.deleteMany({});
    await prisma.organization.deleteMany({ where: { name: 'Cabinet Test E2E' } });
    await prisma.user.deleteMany({ where: { email: { contains: '-tasks@comptabli.com' } } });
    await prisma.$disconnect();
    await app.close();
  });

  const getValidToken = (role: Role, customId?: string) => {
    let id = adminId;
    if (role === Role.CLIENT) id = clientId;
    if (role === Role.COMPTABLE) id = comptableId;
    if (role === Role.COLLABORATEUR) id = collaborateurId;
    if (customId) id = customId;
    return jwtService.sign({ sub: id, email: 'test@comptabli.com', role });
  };

  describe('/tasks (POST)', () => {
    it('should throw 403 Forbidden for a CLIENT trying to create a task', () => {
      const token = getValidToken(Role.CLIENT);
      return request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Task 1', priority: 'HIGH', organizationId: orgId })
        .expect(403);
    });

    it('should throw 403 Forbidden for a COLLABORATEUR trying to create a task', () => {
      const token = getValidToken(Role.COLLABORATEUR);
      return request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Task 2', priority: 'HIGH', organizationId: orgId })
        .expect(403);
    });

    it('should allow COMPTABLE to create a task', async () => {
      const token = getValidToken(Role.COMPTABLE);
      const response = await request(app.getHttpServer())
        .post('/tasks')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Task 3', priority: 'HIGH', organizationId: orgId })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Task 3');
    });
  });

  describe('/tasks/:id/status (PUT)', () => {
    let taskId: string;

    beforeAll(async () => {
      // Create a task via Prisma directly with a valid orgId
      const task = await prisma.task.create({
        data: {
          title: 'To validate',
          priority: 'MEDIUM',
          status: Status.PENDING,
          organizationId: orgId,
          createdBy: comptableId,
          assignees: { connect: [{ id: collaborateurId }] }
        }
      });
      taskId = task.id;
    });

    it('should allow COLLABORATEUR to move task to DONE (if assignee)', () => {
      const token = getValidToken(Role.COLLABORATEUR);
      return request(app.getHttpServer())
        .put(`/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: Status.DONE })
        .expect(200);
    });

    it('should NOT allow COLLABORATEUR to move task to VALIDATED', () => {
      const token = getValidToken(Role.COLLABORATEUR);
      return request(app.getHttpServer())
        .put(`/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: Status.VALIDATED })
        .expect(403);
    });

    it('should allow COMPTABLE to move task to VALIDATED', () => {
      const token = getValidToken(Role.COMPTABLE);
      return request(app.getHttpServer())
        .put(`/tasks/${taskId}/status`)
        .set('Authorization', `Bearer ${token}`)
        .send({ status: Status.VALIDATED })
        .expect(200);
    });
  });
});
