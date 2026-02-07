import { APIEmbedField } from 'discord-api-types/v10';
import { EmbedBuilder } from 'discord.js';
import { Song } from '../../domain/entities/song';

export function buildQueuedEmbed(
  url: string,
  queuedCount: number,
  queueLength: number,
  title: string,
  thumbnail: string,
): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#ffffff')
    .setTitle('Queued')
    .setURL(url)
    .setDescription(`Queued ${queuedCount} track${queuedCount === 1 ? '' : 's'}`)
    .addFields([
      { name: 'Total Queue', value: `${queueLength} tracks` },
      {
        name: 'Track',
        value: `:musical_note:  ${title} :musical_note: has been added to queue`,
      },
    ])
    .setThumbnail(thumbnail);
}

export function buildQueueListEmbed(songs: readonly Song[]): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor('#ffffff')
    .setTitle('Queue')
    .setThumbnail(songs[1]?.thumbnail ?? '');

  const fields: APIEmbedField[] = [];
  songs.forEach((item, idx) => {
    if (idx !== 0 && idx < 26) {
      fields.push({ name: `${idx}`, value: item.title });
    }
  });
  embed.addFields(fields);

  return embed;
}

export function buildHelpEmbed(prefix: string): EmbedBuilder {
  return new EmbedBuilder()
    .setColor('#ffffff')
    .setTitle('Commands')
    .addFields([
      { name: 'prefix', value: prefix },
      { name: 'p', value: `음악 재생 => ${prefix}p [uri]` },
      { name: 's', value: `음악 스킵 => ${prefix}s` },
      { name: 'q', value: `음악 큐 조회 => ${prefix}q` },
      { name: 'eq', value: `음악 큐 제거 => ${prefix}eq` },
      { name: 'l', value: `내보내기 => ${prefix}l` },
    ]);
}
