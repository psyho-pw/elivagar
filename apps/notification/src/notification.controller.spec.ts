import { TestBed, Mocked } from '@suites/unit';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: Mocked<NotificationService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(NotificationController).compile();

    controller = unit;
    notificationService = unitRef.get(NotificationService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('getHello', () => {
    it('should delegate to notificationService.getHello', () => {
      notificationService.getHello.mockReturnValue('Hello World!');

      const result = controller.getHello();

      expect(notificationService.getHello).toHaveBeenCalled();
      expect(result).toBe('Hello World!');
    });
  });
});
