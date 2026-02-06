import { Module } from '@nestjs/common';
import { DiscordWebhookService } from './discord-webhook.service';
import { DiscordController } from './discord.controller';

@Module({
  controllers: [DiscordController],
  providers: [DiscordWebhookService],
  exports: [DiscordWebhookService],
})
export class DiscordModule {}
