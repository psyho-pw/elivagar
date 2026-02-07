import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { ConfigsService } from '../../configs/configs.service';
import { Inject, Injectable } from '@nestjs/common';
import { LeaveChannelUseCase } from './leave-channel.usecase';
import { IMessageSender, MessageSenderPort } from '../domain/ports/message-sender.port';

@Injectable()
export class HandleVoiceStateUseCase {
  constructor(
    private readonly leaveChannelUseCase: LeaveChannelUseCase,
    @Inject(MessageSenderPort) private readonly messageSender: IMessageSender,
    @Inject(ConfigsServiceKey) private readonly configsService: ConfigsService,
  ) {}

  async handleBotAlone(guildId: string, channelId: string): Promise<void> {
    const sentMsg = await this.messageSender.sendError(channelId, '바윙~');
    this.leaveChannelUseCase.execute(guildId);
    setTimeout(
      () => sentMsg.delete().catch(() => {}),
      this.configsService.DiscordConfig.messageDeleteTimeout,
    );
  }
}
