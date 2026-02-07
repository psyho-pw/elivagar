import { faker } from '@faker-js/faker';
import { Metadata } from '@grpc/grpc-js';
import { TestBed, Mocked } from '@suites/unit';
import { SayhoBotController, ISendKafkaTest } from './sayho-bot.controller';
import { SayhoBotService } from './sayho-bot.service';

describe('SayhoBotController', () => {
  let controller: SayhoBotController;
  let sayhoBotService: Mocked<SayhoBotService>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(SayhoBotController).compile();

    controller = unit;
    sayhoBotService = unitRef.get(SayhoBotService);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('getHello', () => {
    it('should delegate to sayhoBotService.getHello()', () => {
      const expected = faker.lorem.sentence();
      sayhoBotService.getHello.mockReturnValue(expected);

      const result = controller.getHello();

      expect(sayhoBotService.getHello).toHaveBeenCalled();
      expect(result).toBe(expected);
    });
  });

  describe('sendKafkaTest', () => {
    it('should call sendNotification with the message and return success response', () => {
      const message = faker.lorem.sentence();
      const body: ISendKafkaTest['body'] = { message };

      const result = controller.sendKafkaTest(body);

      expect(sayhoBotService.sendNotification).toHaveBeenCalledWith(message);
      expect(result).toEqual({ success: true, message: `Event sent: ${message}` });
    });

    it('should call sendNotification exactly once', () => {
      const body: ISendKafkaTest['body'] = { message: faker.lorem.word() };

      controller.sendKafkaTest(body);

      expect(sayhoBotService.sendNotification).toHaveBeenCalledTimes(1);
    });
  });

  describe('ping', () => {
    it('should return Pong message', () => {
      const result = controller.ping({
        data: { message: faker.lorem.word() },
        metadata: new Metadata(),
        call: {} as never,
      });

      expect(result).toEqual({ message: 'Pong' });
    });

    it('should ignore the input data and always return Pong', () => {
      const result = controller.ping({
        data: { message: '' },
        metadata: new Metadata(),
        call: {} as never,
      });

      expect(result).toEqual({ message: 'Pong' });
    });
  });
});
