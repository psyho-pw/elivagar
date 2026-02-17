import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { LoggerService } from '@app/core/logger/logger.service';
import { SayhoBotErrorEvent } from '@app/kafka/events/events.interface';
import { Inject, Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { ConfigsService } from '../configs/configs.service';

export interface EmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

@Injectable()
export class DiscordWebhookService implements OnModuleInit, OnModuleDestroy {
  private webhookClient!: WebhookClient;

  constructor(
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
    private readonly loggerService: LoggerService,
  ) {}

  onModuleInit(): void {
    const { webhookUrl } = this.configsService.DiscordWebhookConfig;
    this.webhookClient = new WebhookClient({ url: webhookUrl });
  }

  async sendMessage(message: string, title?: string, additional?: EmbedField[]): Promise<void> {
    const embed = new EmbedBuilder()
      .setTitle(title ?? 'Error Report')
      .setColor(0xff0000)
      .setTimestamp()
      .addFields([{ name: 'Message', value: message.substring(0, 1024) }]);

    if (additional) {
      embed.addFields(
        additional.map((field) => ({
          ...field,
          value: field.value.substring(0, 1024),
        })),
      );
    }

    try {
      await this.webhookClient.send({ embeds: [embed] });
    } catch (error) {
      this.loggerService.error('sendMessage', error, 'Failed to send Discord webhook message');
    }
  }

  async sendErrorReport(event: SayhoBotErrorEvent): Promise<void> {
    await this.sendMessage(event.message, `Error in ${event.context}`, [
      { name: 'Stack', value: event.stack || 'No stack trace' },
      { name: 'Context', value: event.context },
      { name: 'Timestamp', value: event.timestamp },
    ]);
  }

  async onModuleDestroy(): Promise<void> {
    this.webhookClient.destroy();
  }
}
