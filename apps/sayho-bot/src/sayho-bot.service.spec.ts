import { KafkaTopics } from '@app/kafka/events/events.constant';
import { KafkaServiceKey } from '@app/kafka/kafka/kafka.constant';
import { IKafkaService } from '@app/kafka/kafka/kafka.interface';
import { faker } from '@faker-js/faker';
import { TestBed, Mocked } from '@suites/unit';
import { SayhoBotService } from './sayho-bot.service';

describe('SayhoBotService', () => {
  let service: SayhoBotService;
  let kafkaService: Mocked<IKafkaService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SayhoBotService).compile();

    service = unit;
    kafkaService = unitRef.get(KafkaServiceKey);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('getHello', () => {
    it('should return "Hello World!"', () => {
      expect(service.getHello()).toBe('Hello World!');
    });
  });

  describe('sendNotification', () => {
    it('should emit a Kafka message to the notification.email.sent topic', () => {
      const message = faker.lorem.sentence();

      service.sendNotification(message);

      expect(kafkaService.emit).toHaveBeenCalledWith(
        KafkaTopics.Notification.EmailSent,
        expect.objectContaining({
          from: 'sayho-bot',
          to: 'notification',
          message,
          timestamp: expect.any(String),
        }),
      );
    });

    it('should include an ISO timestamp in the emitted message', () => {
      const message = faker.lorem.sentence();
      service.sendNotification(message);

      const emittedPayload = kafkaService.emit.mock.calls[0][1] as unknown as { timestamp: string };
      expect(() => new Date(emittedPayload.timestamp).toISOString()).not.toThrow();
    });

    it('should call emit exactly once per call', () => {
      const message1 = faker.lorem.sentence();
      const message2 = faker.lorem.sentence();
      service.sendNotification(message1);
      service.sendNotification(message2);

      expect(kafkaService.emit).toHaveBeenCalledTimes(2);
    });
  });
});
