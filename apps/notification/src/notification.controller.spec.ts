import { faker } from '@faker-js/faker';
import { Metadata, ServerUnaryCall } from '@grpc/grpc-js';
import { TestBed, Mocked } from '@suites/unit';
import { NotificationType } from './notification/notification.constant';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';

describe('NotificationController', () => {
  let controller: NotificationController;
  let notificationService: Mocked<NotificationService>;

  const testUserId = faker.string.uuid();
  const testNotificationId = faker.string.uuid();
  const testTitle = faker.lorem.sentence();
  const testMessage = faker.lorem.paragraph();
  const testCreatedAt = faker.date.recent().toISOString();

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(NotificationController).compile();

    controller = unit;
    notificationService = unitRef.get(NotificationService);
  });

  beforeEach(() => jest.clearAllMocks());

  const mockMetadata = {} as Metadata;
  const mockCall = {} as ServerUnaryCall<unknown, unknown>;

  describe('getHello', () => {
    it('should return service running message', () => {
      const result = controller.getHello();
      expect(result).toBe('Notification service is running');
    });
  });

  describe('SendNotification', () => {
    it('should delegate to notificationService.create', async () => {
      const expected = {
        id: testNotificationId,
        userId: testUserId,
        title: testTitle,
        message: testMessage,
        type: NotificationType.INFO,
        isRead: false,
        createdAt: testCreatedAt,
      };
      notificationService.create.mockResolvedValue(expected);

      const data = {
        userId: testUserId,
        title: testTitle,
        message: testMessage,
        type: 'INFO',
      };
      const sendNotification = controller.SendNotification as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await sendNotification.call(controller, data, mockMetadata, mockCall);

      expect(notificationService.create).toHaveBeenCalledWith(
        testUserId,
        testTitle,
        testMessage,
        NotificationType.INFO,
      );
      expect(result).toEqual({ id: testNotificationId });
    });
  });

  describe('GetNotifications', () => {
    it('should delegate to notificationService.findAllByUser', async () => {
      const items = [
        {
          id: testNotificationId,
          userId: testUserId,
          title: testTitle,
          message: testMessage,
          type: NotificationType.INFO,
          isRead: false,
          createdAt: testCreatedAt,
        },
      ];
      notificationService.findAllByUser.mockResolvedValue({ items, total: 1 });

      const data = { userId: testUserId, page: 1, limit: 20, unreadOnly: false };
      const getNotifications = controller.GetNotifications as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await getNotifications.call(controller, data, mockMetadata, mockCall);

      expect(notificationService.findAllByUser).toHaveBeenCalledWith(testUserId, 1, 20, false);
      expect(result).toEqual({ items, total: 1 });
    });
  });

  describe('GetNotification', () => {
    it('should delegate to notificationService.findOne', async () => {
      const expected = {
        id: testNotificationId,
        userId: testUserId,
        title: testTitle,
        message: testMessage,
        type: NotificationType.INFO,
        isRead: false,
        createdAt: testCreatedAt,
      };
      notificationService.findOne.mockResolvedValue(expected);

      const data = { id: testNotificationId };
      const getNotification = controller.GetNotification as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await getNotification.call(controller, data, mockMetadata, mockCall);

      expect(notificationService.findOne).toHaveBeenCalledWith(testNotificationId);
      expect(result).toEqual(expected);
    });
  });

  describe('MarkAsRead', () => {
    it('should delegate to notificationService.markAsRead', async () => {
      const ids = [faker.string.uuid(), faker.string.uuid()];
      notificationService.markAsRead.mockResolvedValue(2);

      const data = { ids };
      const markAsRead = controller.MarkAsRead as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await markAsRead.call(controller, data, mockMetadata, mockCall);

      expect(notificationService.markAsRead).toHaveBeenCalledWith(ids);
      expect(result).toEqual({ updatedCount: 2 });
    });
  });

  describe('DeleteNotification', () => {
    it('should delegate to notificationService.remove', async () => {
      notificationService.remove.mockResolvedValue(true);

      const data = { id: testNotificationId };
      const deleteNotification = controller.DeleteNotification as unknown as (
        data: unknown,
        metadata: Metadata,
        call: ServerUnaryCall<unknown, unknown>,
      ) => Promise<unknown>;
      const result = await deleteNotification.call(controller, data, mockMetadata, mockCall);

      expect(notificationService.remove).toHaveBeenCalledWith(testNotificationId);
      expect(result).toEqual({ success: true });
    });
  });

  describe('handleUserCreated', () => {
    it('should create a welcome notification for new user', async () => {
      const event = {
        userId: testUserId,
        email: faker.internet.email(),
        name: 'Test User',
      };
      notificationService.create.mockResolvedValue({
        id: testNotificationId,
        userId: testUserId,
        title: 'Welcome!',
        message: 'Welcome to Elivagar, Test User!',
        type: NotificationType.AUTH,
        isRead: false,
        createdAt: testCreatedAt,
      });

      await controller.handleUserCreated(event);

      expect(notificationService.create).toHaveBeenCalledWith(
        testUserId,
        'Welcome!',
        'Welcome to Elivagar, Test User!',
        NotificationType.AUTH,
      );
    });
  });
});
