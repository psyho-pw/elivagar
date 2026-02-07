import { LoggerService } from '@app/core/logger/logger.service';
import { TestBed, Mocked } from '@suites/unit';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let _loggerService: Mocked<LoggerService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(NotificationService).compile();

    service = unit;
    _loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });
});
