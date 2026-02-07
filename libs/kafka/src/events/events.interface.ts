/** Event payload for KafkaTopics.SayhoBot.ErrorOccurred */
export interface SayhoBotErrorEvent {
  message: string;
  stack: string;
  context: string;
  timestamp: string;
}
