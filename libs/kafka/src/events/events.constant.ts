/**
 * Kafka Event Topics
 *
 * Naming convention: {service}.{entity}.{action}
 * Example: auth.user.created, notification.email.sent
 */
export const KafkaTopics = {
  // Auth service events
  Auth: {
    UserCreated: 'auth.user.created',
    UserUpdated: 'auth.user.updated',
    UserDeleted: 'auth.user.deleted',
    SessionCreated: 'auth.session.created',
    SessionRevoked: 'auth.session.revoked',
  },

  // Notification service events
  Notification: {
    EmailSent: 'notification.email.sent',
    EmailFailed: 'notification.email.failed',
    PushSent: 'notification.push.sent',
    PushFailed: 'notification.push.failed',
  },

  // Sayho-bot service events
  SayhoBot: {
    MessageReceived: 'sayho-bot.message.received',
    ResponseSent: 'sayho-bot.response.sent',
    CommandExecuted: 'sayho-bot.command.executed',
    SongPlayed: 'sayho-bot.song.played',
    ErrorOccurred: 'sayho-bot.error.occurred',
  },
} as const;

import { Union } from '@app/core/types/union.type';

export type AuthTopics = Union<typeof KafkaTopics.Auth>;
export type NotificationTopics = Union<typeof KafkaTopics.Notification>;
export type SayhoBotTopics = Union<typeof KafkaTopics.SayhoBot>;
