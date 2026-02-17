import { LoggerService } from '@app/core/logger/logger.service';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { EntityManager, FilterQuery } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { NotificationType } from './notification/notification.constant';
import { Notification } from './notification/notification.entity';
import { NotificationListResult, NotificationResult } from './notification/notification.interface';

@Injectable()
export class NotificationService {
  constructor(
    private readonly em: EntityManager,
    private readonly loggerService: LoggerService,
  ) {}

  async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
  ): Promise<NotificationResult> {
    const notification = this.em.create(Notification, {
      userId,
      title,
      message,
      type,
    } as unknown as Notification);
    await this.em.flush();

    return this.toResult(notification);
  }

  async findAllByUser(
    userId: string,
    page: number,
    limit: number,
    unreadOnly: boolean,
  ): Promise<NotificationListResult> {
    const where: FilterQuery<Notification> = { userId, deletedAt: null };
    if (unreadOnly) {
      where.isRead = false;
    }

    const [notifications, total] = await this.em.findAndCount(Notification, where, {
      orderBy: { createdAt: 'DESC' },
      offset: (page - 1) * limit,
      limit,
    });

    return {
      items: notifications.map((n) => this.toResult(n)),
      total,
    };
  }

  async findOne(id: string): Promise<NotificationResult> {
    const notification = await this.em.findOne(Notification, { id, deletedAt: null });
    if (!notification) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    return this.toResult(notification);
  }

  async markAsRead(ids: string[]): Promise<number> {
    const count = await this.em.nativeUpdate(
      Notification,
      { id: { $in: ids }, deletedAt: null, isRead: false },
      { isRead: true },
    );

    return count;
  }

  async remove(id: string): Promise<boolean> {
    const notification = await this.em.findOne(Notification, { id, deletedAt: null });
    if (!notification) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    notification.deletedAt = new Date();
    await this.em.flush();

    return true;
  }

  private toResult(notification: Notification): NotificationResult {
    return {
      id: notification.id,
      userId: notification.userId,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      isRead: notification.isRead,
      createdAt: notification.createdAt.toISOString(),
    };
  }
}
