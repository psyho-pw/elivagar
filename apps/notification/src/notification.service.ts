import { LoggerService } from '@app/core/logger/logger.service';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { MikroORM, Transactional } from '@mikro-orm/core';
import { FilterQuery } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { NotificationType } from './notification/notification.constant';
import { Notification } from './notification/notification.entity';
import { NotificationListResult, NotificationResult } from './notification/notification.interface';
import { NotificationRepository } from './notification/notification.repository';

@Injectable()
export class NotificationService {
  constructor(
    private readonly orm: MikroORM,
    private readonly notificationRepository: NotificationRepository,
    private readonly loggerService: LoggerService,
  ) {}

  @Transactional()
  async create(
    userId: string,
    title: string,
    message: string,
    type: NotificationType,
  ): Promise<NotificationResult> {
    const notification = this.notificationRepository.create({
      userId,
      title,
      message,
      type,
    } as unknown as Notification);

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

    const [notifications, total] = await this.notificationRepository.findAndCount(where, {
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
    const notification = await this.notificationRepository.findOne({ id, deletedAt: null });
    if (!notification) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    return this.toResult(notification);
  }

  @Transactional()
  async markAsRead(ids: string[]): Promise<number> {
    const count = await this.notificationRepository.nativeUpdate(
      { id: { $in: ids }, deletedAt: null, isRead: false },
      { isRead: true },
    );

    return count;
  }

  @Transactional()
  async remove(id: string): Promise<boolean> {
    const notification = await this.notificationRepository.findOne({ id, deletedAt: null });
    if (!notification) {
      throw new RpcException({
        code: GrpcStatus.NOT_FOUND,
        message: 'Notification not found',
      });
    }

    notification.deletedAt = new Date();

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
