import { Test, TestingModule } from '@nestjs/testing';
import { TasksService } from './tasks.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Role, Status } from '@prisma/client';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { createPrismaMock, MockPrismaService } from '../prisma/prisma.mock';

describe('TasksService', () => {
  let service: TasksService;
  let prisma: MockPrismaService;
  let notificationsServiceMock: any;

  beforeEach(async () => {
    prisma = createPrismaMock();

    notificationsServiceMock = {
      createForUser: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: NotificationsService, useValue: notificationsServiceMock },
      ],
    }).compile();

    service = module.get<TasksService>(TasksService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('updateStatus', () => {
    it('should throw NotFoundException if task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.updateStatus('invalid-id', Status.DONE, 'user-id', Role.COMPTABLE)
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user is not assignee, creator, or admin', async () => {
      const mockTask = {
        id: 'task-1',
        createdBy: 'creator-id',
        assignees: [{ id: 'assignee-id' }],
      };
      prisma.task.findUnique.mockResolvedValue(mockTask as any);

      await expect(
        service.updateStatus('task-1', Status.DONE, 'unauthorized-id', Role.CLIENT)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ForbiddenException if trying to validate as non-accountant/non-admin', async () => {
      const mockTask = {
        id: 'task-1',
        createdBy: 'collaborator-id',
        assignees: [{ id: 'collaborator-id' }],
      };
      prisma.task.findUnique.mockResolvedValue(mockTask as any);

      await expect(
        service.updateStatus('task-1', Status.VALIDATED, 'collaborator-id', Role.COLLABORATEUR)
      ).rejects.toThrow(ForbiddenException);
    });

    it('should allow accountant to validate a task and notify', async () => {
      const mockTask = {
        id: 'task-1',
        createdBy: 'accountant-id',
        assignees: [{ id: 'accountant-id' }],
        requestId: null,
        title: 'Bilan',
      };
      prisma.task.findUnique.mockResolvedValue(mockTask as any);
      
      const mockUpdated = { ...mockTask, status: Status.VALIDATED, archived: true };
      prisma.task.update.mockResolvedValue(mockUpdated as any);

      const result = await service.updateStatus('task-1', Status.VALIDATED, 'accountant-id', Role.COMPTABLE);
      
      expect(result.status).toBe(Status.VALIDATED);
      expect(prisma.task.update).toHaveBeenCalledWith({
        where: { id: 'task-1' },
        data: expect.objectContaining({
          status: Status.VALIDATED,
          archived: true,
        }),
        include: expect.any(Object),
      });
      expect(notificationsServiceMock.createForUser).toHaveBeenCalledWith(
        'accountant-id',
        expect.objectContaining({ type: 'TASK_VALIDATED' })
      );
    });
  });
});
