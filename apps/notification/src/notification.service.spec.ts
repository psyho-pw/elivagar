import { LoggerService } from '@app/core/logger/logger.service';
import { faker } from '@faker-js/faker';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { RpcException } from '@nestjs/microservices';
import { TestBed, Mocked } from '@suites/unit';
import { makeNotification } from '@test/factories/notification.factory';

import { NotificationType } from './notification/notification.constant';
import { NotificationRepository } from './notification/notification.repository';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let notificationRepository: Mocked<NotificationRepository>;
  let _loggerService: Mocked<LoggerService>;

  const testUserId = faker.string.uuid();
  const testNotificationId = faker.string.uuid();
  const testTitle = faker.lorem.sentence();
  const testMessage = faker.lorem.paragraph();

  const mockNotification = makeNotification({
    id: testNotificationId,
    userId: testUserId,
    title: testTitle,
    message: testMessage,
    type: NotificationType.INFO,
  });

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(NotificationService).compile();

    service = unit;
    notificationRepository = unitRef.get(NotificationRepository);
    _loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a notification and return result', async () => {
      notificationRepository.create.mockReturnValue(mockNotification);

      const result = await service.create(
        testUserId,
        testTitle,
        testMessage,
        NotificationType.INFO,
      );

      expect(notificationRepository.create).toHaveBeenCalledWith({
        userId: testUserId,
        title: testTitle,
        message: testMessage,
        type: NotificationType.INFO,
      });
      expect(result.id).toBe(testNotificationId);
      expect(result.userId).toBe(testUserId);
      expect(result.title).toBe(testTitle);
      expect(result.message).toBe(testMessage);
      expect(result.type).toBe(NotificationType.INFO);
    });
  });

  describe('findAllByUser', () => {
    it('should return paginated notifications for a user', async () => {
      const notifications = [mockNotification];
      notificationRepository.findAndCount.mockResolvedValue([notifications, 1]);

      const result = await service.findAllByUser(testUserId, 1, 20, false);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        { userId: testUserId, deletedAt: null },
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 20 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter unread only when unreadOnly is true', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(testUserId, 1, 20, true);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        { userId: testUserId, deletedAt: null, isRead: false },
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 20 },
      );
    });

    it('should calculate correct offset for page 2', async () => {
      notificationRepository.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(testUserId, 2, 10, false);

      expect(notificationRepository.findAndCount).toHaveBeenCalledWith(
        { userId: testUserId, deletedAt: null },
        { orderBy: { createdAt: 'DESC' }, offset: 10, limit: 10 },
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      notificationRepository.findOne.mockResolvedValue(mockNotification);

      const result = await service.findOne(testNotificationId);

      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        id: testNotificationId,
        deletedAt: null,
      });
      expect(result.id).toBe(testNotificationId);
    });

    it('should throw NOT_FOUND when notification does not exist', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      const error = await service.findOne(faker.string.uuid()).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    });
  });

  describe('markAsRead', () => {
    it('should update unread notifications and return count', async () => {
      const ids = [faker.string.uuid(), faker.string.uuid()];
      notificationRepository.nativeUpdate.mockResolvedValue(2);

      const count = await service.markAsRead(ids);

      expect(notificationRepository.nativeUpdate).toHaveBeenCalledWith(
        { id: { $in: ids }, deletedAt: null, isRead: false },
        { isRead: true },
      );
      expect(count).toBe(2);
    });

    it('should return 0 when no notifications match', async () => {
      notificationRepository.nativeUpdate.mockResolvedValue(0);

      const count = await service.markAsRead([faker.string.uuid()]);

      expect(count).toBe(0);
    });
  });

  describe('remove', () => {
    it('should soft delete a notification', async () => {
      const notification = makeNotification({ id: testNotificationId });
      notificationRepository.findOne.mockResolvedValue(notification);

      const result = await service.remove(testNotificationId);

      expect(notificationRepository.findOne).toHaveBeenCalledWith({
        id: testNotificationId,
        deletedAt: null,
      });
      expect(notification.deletedAt).toBeInstanceOf(Date);
      expect(result).toBe(true);
    });

    it('should throw NOT_FOUND when notification does not exist', async () => {
      notificationRepository.findOne.mockResolvedValue(null);

      const error = await service.remove(faker.string.uuid()).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    });
  });
});
