import { Injectable } from '@nestjs/common';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { Song } from '../../domain/entities/song';
import { IMessageSender, MessageEmbed, SentMessage } from '../../domain/ports/message-sender.port';

@Injectable()
export class DiscordMessageSenderAdapter implements IMessageSender {
  private client: Client | null = null;

  setClient(client: Client): void {
    this.client = client;
  }

  private getTextChannel(channelId: string): TextChannel {
    if (!this.client) throw new Error('Discord client not initialized');
    const channel = this.client.channels.cache.get(channelId);
    if (!channel?.isTextBased() || channel.isDMBased()) {
      throw new Error(`Text channel ${channelId} not found`);
    }
    return channel as TextChannel;
  }

  private toSentMessage(msg: {
    id: string;
    channelId: string;
    delete(): Promise<unknown>;
  }): SentMessage {
    return {
      id: msg.id,
      channelId: msg.channelId,
      delete: () => msg.delete().then(() => {}),
    };
  }

  async sendEmbed(channelId: string, embed: MessageEmbed): Promise<SentMessage> {
    const channel = this.getTextChannel(channelId);
    const builder = new EmbedBuilder();

    if (embed.title) builder.setTitle(embed.title);
    if (embed.description) builder.setDescription(embed.description);
    if (embed.color !== undefined) builder.setColor(embed.color);
    if (embed.thumbnail) builder.setThumbnail(embed.thumbnail);
    if (embed.fields) {
      builder.addFields(
        embed.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
      );
    }
    if (embed.footer) builder.setFooter({ text: embed.footer });

    const msg = await channel.send({ embeds: [builder] });
    return this.toSentMessage(msg);
  }

  async sendNowPlaying(channelId: string, song: Song): Promise<SentMessage> {
    const channel = this.getTextChannel(channelId);
    const embed = new EmbedBuilder()
      .setColor('#0099ff')
      .setTitle(`:: Currently playing :arrow_forward: ::`)
      .setDescription(`[${song.title}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields([{ name: 'Duration', value: song.duration || '??:??' }]);

    const msg = await channel.send({ embeds: [embed] });
    return this.toSentMessage(msg);
  }

  async sendAddedToQueue(channelId: string, song: Song, position: number): Promise<SentMessage> {
    const channel = this.getTextChannel(channelId);
    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('Queued')
      .setURL(song.url)
      .setDescription(`Queued 1 track`)
      .addFields([
        { name: 'Position', value: `${position}` },
        {
          name: 'Track',
          value: `:musical_note:  ${song.title} :musical_note: has been added to queue`,
        },
      ])
      .setThumbnail(song.thumbnail);

    const msg = await channel.send({ embeds: [embed] });
    return this.toSentMessage(msg);
  }

  async sendQueueList(channelId: string, songs: readonly Song[]): Promise<SentMessage> {
    const channel = this.getTextChannel(channelId);
    const embed = new EmbedBuilder()
      .setColor('#ffffff')
      .setTitle('Queue')
      .setThumbnail(songs[1]?.thumbnail ?? '');

    const fields = songs
      .slice(1, 26)
      .map((item, idx) => ({ name: `${idx + 1}`, value: item.title }));
    embed.addFields(fields);

    const msg = await channel.send({ embeds: [embed] });
    return this.toSentMessage(msg);
  }

  async sendError(channelId: string, message: string): Promise<SentMessage> {
    const channel = this.getTextChannel(channelId);
    const msg = await channel.send(message);
    return this.toSentMessage(msg);
  }

  async deleteMessage(message: SentMessage): Promise<void> {
    await message.delete();
  }
}
