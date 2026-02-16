import { LoggerService } from '@app/core/logger/logger.service';
import { faker } from '@faker-js/faker';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { EntityManager } from '@mikro-orm/postgresql';
import { RpcException } from '@nestjs/microservices';
import { TestBed, Mocked } from '@suites/unit';
import { makeNotification } from '@test/factories/notification.factory';

import { Notification, NotificationType } from './notification/notification.entity';
import { NotificationService } from './notification.service';

describe('NotificationService', () => {
  let service: NotificationService;
  let em: Mocked<EntityManager>;
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
    em = unitRef.get(EntityManager);
    _loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('create', () => {
    it('should create a notification and return result', async () => {
      em.create.mockReturnValue(mockNotification);

      const result = await service.create(testUserId, testTitle, testMessage, NotificationType.INFO);

      expect(em.create).toHaveBeenCalledWith(Notification, {
        userId: testUserId,
        title: testTitle,
        message: testMessage,
        type: NotificationType.INFO,
      });
      expect(em.flush).toHaveBeenCalled();
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
      em.findAndCount.mockResolvedValue([notifications, 1]);

      const result = await service.findAllByUser(testUserId, 1, 20, false);

      expect(em.findAndCount).toHaveBeenCalledWith(
        Notification,
        { userId: testUserId, deletedAt: null },
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 20 },
      );
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should filter unread only when unreadOnly is true', async () => {
      em.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(testUserId, 1, 20, true);

      expect(em.findAndCount).toHaveBeenCalledWith(
        Notification,
        { userId: testUserId, deletedAt: null, isRead: false },
        { orderBy: { createdAt: 'DESC' }, offset: 0, limit: 20 },
      );
    });

    it('should calculate correct offset for page 2', async () => {
      em.findAndCount.mockResolvedValue([[], 0]);

      await service.findAllByUser(testUserId, 2, 10, false);

      expect(em.findAndCount).toHaveBeenCalledWith(
        Notification,
        { userId: testUserId, deletedAt: null },
        { orderBy: { createdAt: 'DESC' }, offset: 10, limit: 10 },
      );
    });
  });

  describe('findOne', () => {
    it('should return a notification by id', async () => {
      em.findOne.mockResolvedValue(mockNotification);

      const result = await service.findOne(testNotificationId);

      expect(em.findOne).toHaveBeenCalledWith(Notification, {
        id: testNotificationId,
        deletedAt: null,
      });
      expect(result.id).toBe(testNotificationId);
    });

    it('should throw NOT_FOUND when notification does not exist', async () => {
      em.findOne.mockResolvedValue(null);

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
      em.nativeUpdate.mockResolvedValue(2);

      const count = await service.markAsRead(ids);

      expect(em.nativeUpdate).toHaveBeenCalledWith(
        Notification,
        { id: { $in: ids }, deletedAt: null, isRead: false },
        { isRead: true },
      );
      expect(count).toBe(2);
    });

    it('should return 0 when no notifications match', async () => {
      em.nativeUpdate.mockResolvedValue(0);

      const count = await service.markAsRead([faker.string.uuid()]);

      expect(count).toBe(0);
    });
  });

  describe('remove', () => {
    it('should soft delete a notification', async () => {
      const notification = makeNotification({ id: testNotificationId });
      em.findOne.mockResolvedValue(notification);

      const result = await service.remove(testNotificationId);

      expect(em.findOne).toHaveBeenCalledWith(Notification, {
        id: testNotificationId,
        deletedAt: null,
      });
      expect(notification.deletedAt).toBeInstanceOf(Date);
      expect(em.flush).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('should throw NOT_FOUND when notification does not exist', async () => {
      em.findOne.mockResolvedValue(null);

      const error = await service.remove(faker.string.uuid()).catch((err: unknown) => err);

      expect(error).toBeInstanceOf(RpcException);
      expect((error as RpcException).getError()).toEqual({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    });
  });
});
