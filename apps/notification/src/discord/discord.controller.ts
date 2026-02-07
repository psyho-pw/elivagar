import { KafkaTopics } from '@app/kafka/events/events.constant';
import { SayhoBotErrorEvent } from '@app/kafka/events/events.interface';
import { Controller } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { DiscordWebhookService } from './discord-webhook.service';

@Controller()
export class DiscordController {
  constructor(private readonly discordWebhookService: DiscordWebhookService) {}

  @EventPattern(KafkaTopics.SayhoBot.ErrorOccurred)
  async handleSayhoBotError(@Payload() data: SayhoBotErrorEvent): Promise<void> {
    await this.discordWebhookService.sendErrorReport(data);
  }
}
