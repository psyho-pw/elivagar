/** Event payload for KafkaTopics.Auth.UserCreated */
export interface AuthUserCreatedEvent {
  userId: string;
  email: string;
  name: string;
}

/** Event payload for KafkaTopics.Auth.SessionRevoked */
export interface AuthSessionRevokedEvent {
  tokenHash: string;
  userId: string;
  reason?: string;
}

/** Event payload for KafkaTopics.SayhoBot.ErrorOccurred */
export interface SayhoBotErrorEvent {
  message: string;
  stack: string;
  context: string;
  timestamp: string;
}
