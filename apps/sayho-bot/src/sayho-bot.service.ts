import { KafkaTopics } from '@app/kafka/events/events.constant';
import { KafkaServiceKey } from '@app/kafka/kafka/kafka.constant';
import { IKafkaService } from '@app/kafka/kafka/kafka.interface';
import { Inject, Injectable } from '@nestjs/common';

@Injectable()
export class SayhoBotService {
  constructor(@Inject(KafkaServiceKey) private readonly kafkaService: IKafkaService) {}

  getHello(): string {
    return 'Hello World!';
  }

  sendNotification(message: string): void {
    this.kafkaService.emit(KafkaTopics.Notification.EmailSent, {
      from: 'sayho-bot',
      to: 'notification',
      message,
      timestamp: new Date().toISOString(),
    });
  }
}
