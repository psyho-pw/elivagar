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
  },
} as const;

export type AuthTopics = (typeof KafkaTopics.Auth)[keyof typeof KafkaTopics.Auth];
export type NotificationTopics =
  (typeof KafkaTopics.Notification)[keyof typeof KafkaTopics.Notification];
export type SayhoBotTopics = (typeof KafkaTopics.SayhoBot)[keyof typeof KafkaTopics.SayhoBot];
