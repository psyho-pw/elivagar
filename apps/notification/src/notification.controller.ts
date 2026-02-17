import { Public } from '@app/auth/decorators/public.decorator';
import { TransformDto } from '@app/grpc/grpc/grpc.decorator';
import { GrpcDto } from '@app/grpc/grpc/grpc.interface';
import {
  DeleteNotificationRequest,
  DeleteNotificationResponse,
  GetNotificationRequest,
  GetNotificationsRequest,
  GetNotificationsResponse,
  MarkAsReadRequest,
  MarkAsReadResponse,
  NotificationItem,
  NotificationServiceServiceName,
  SendNotificationRequest,
  SendNotificationResponse,
} from '@app/grpc/proto/generated/notification/v1/notification';
import { KafkaTopics } from '@app/kafka/events/events.constant';
import { AuthUserCreatedEvent } from '@app/kafka/events/events.interface';
import { Controller, Get } from '@nestjs/common';
import { EventPattern, GrpcMethod, Payload } from '@nestjs/microservices';
import { isNotificationType, NotificationType } from './notification/notification.constant';
import { NotificationService } from './notification.service';

@Controller('/')
export class NotificationController {
  constructor(private readonly notificationService: NotificationService) {}

  @Public()
  @Get('/')
  getHello(): string {
    return 'Notification service is running';
  }

  @GrpcMethod(NotificationServiceServiceName)
  @TransformDto()
  async SendNotification({
    data,
  }: GrpcDto<
    SendNotificationRequest,
    SendNotificationResponse
  >): Promise<SendNotificationResponse> {
    const type = isNotificationType(data.type) ? data.type : NotificationType.INFO;
    const result = await this.notificationService.create(
      data.userId,
      data.title,
      data.message,
      type,
    );
    return { id: result.id };
  }

  @GrpcMethod(NotificationServiceServiceName)
  @TransformDto()
  async GetNotifications({
    data,
  }: GrpcDto<
    GetNotificationsRequest,
    GetNotificationsResponse
  >): Promise<GetNotificationsResponse> {
    const result = await this.notificationService.findAllByUser(
      data.userId,
      data.page || 1,
      data.limit || 20,
      data.unreadOnly,
    );
    return {
      items: result.items as NotificationItem[],
      total: result.total,
    };
  }

  @GrpcMethod(NotificationServiceServiceName)
  @TransformDto()
  async GetNotification({
    data,
  }: GrpcDto<GetNotificationRequest, NotificationItem>): Promise<NotificationItem> {
    return (await this.notificationService.findOne(data.id)) as NotificationItem;
  }

  @GrpcMethod(NotificationServiceServiceName)
  @TransformDto()
  async MarkAsRead({
    data,
  }: GrpcDto<MarkAsReadRequest, MarkAsReadResponse>): Promise<MarkAsReadResponse> {
    const updatedCount = await this.notificationService.markAsRead(data.ids);
    return { updatedCount };
  }

  @GrpcMethod(NotificationServiceServiceName)
  @TransformDto()
  async DeleteNotification({
    data,
  }: GrpcDto<
    DeleteNotificationRequest,
    DeleteNotificationResponse
  >): Promise<DeleteNotificationResponse> {
    const success = await this.notificationService.remove(data.id);
    return { success };
  }

  @EventPattern(KafkaTopics.Auth.UserCreated)
  async handleUserCreated(@Payload() data: AuthUserCreatedEvent): Promise<void> {
    await this.notificationService.create(
      data.userId,
      'Welcome!',
      `Welcome to Elivagar, ${data.name}!`,
      NotificationType.AUTH,
    );
  }
}
