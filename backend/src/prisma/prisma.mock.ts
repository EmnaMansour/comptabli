import { PrismaClient } from '@prisma/client';
import { mockDeep, DeepMockProxy } from 'jest-mock-extended';
import { PrismaService } from './prisma.service';

export type MockPrismaService = DeepMockProxy<PrismaClient>;

export const createPrismaMock = () => mockDeep<PrismaClient>() as unknown as DeepMockProxy<PrismaService>;
