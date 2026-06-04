import { Test, TestingModule } from '@nestjs/testing';
import { AiService } from './ai.service';

// Mock the entire generative-ai module
jest.mock('@google/generative-ai', () => {
  return {
    GoogleGenerativeAI: jest.fn().mockImplementation(() => ({
      getGenerativeModel: jest.fn().mockReturnValue({
        generateContent: jest.fn().mockResolvedValue({
          response: {
            text: () => JSON.stringify({
              type: 'FACTURE',
              summary: 'TEST SUMMARY',
              total_ttc: '100.00'
            })
          }
        })
      })
    }))
  };
});

describe('AiService', () => {
  let service: AiService;

  beforeEach(async () => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    const module: TestingModule = await Test.createTestingModule({
      providers: [AiService],
    }).compile();
    service = module.get<AiService>(AiService);
  });

  it('should be defined', () => expect(service).toBeDefined());

  describe('extractData', () => {
    it('returns mock data if API key is missing', async () => {
      delete process.env.GEMINI_API_KEY;
      const localService = new AiService();
      const buffer = Buffer.from('test');
      const result = await localService.extractData(buffer, 'image/png');
      expect(result.type).toBe('FACTURE');
      expect(result.summary).toContain('SIMULATION');
    });

    it('returns parsed JSON from Gemini response', async () => {
      const buffer = Buffer.from('test');
      const result = await service.extractData(buffer, 'image/png');
      expect(result.type).toBe('FACTURE');
      expect(result.summary).toBe('TEST SUMMARY');
      expect(result.total_ttc).toBe('100.00');
    });
  });
});
