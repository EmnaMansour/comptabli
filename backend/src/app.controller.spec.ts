import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;
  let prismaServiceMock: any;

  beforeEach(async () => {
    prismaServiceMock = {
      user: { upsert: jest.fn(), findUnique: jest.fn(), update: jest.fn(), create: jest.fn(), findMany: jest.fn() },
      accountantProfile: { upsert: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      accountantClient: { upsert: jest.fn() },
      review: { updateMany: jest.fn(), findMany: jest.fn() },
    };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: prismaServiceMock,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });
});
