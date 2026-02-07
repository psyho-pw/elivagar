import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IConfigsService } from '@app/core/configs/configs.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { faker } from '@faker-js/faker';
import { Mocked, TestBed } from '@suites/unit';
import { EmbedBuilder, WebhookClient } from 'discord.js';
import { DiscordWebhookService } from './discord-webhook.service';

jest.mock('discord.js', () => {
  const mockEmbedBuilder = {
    setTitle: jest.fn().mockReturnThis(),
    setColor: jest.fn().mockReturnThis(),
    setTimestamp: jest.fn().mockReturnThis(),
    addFields: jest.fn().mockReturnThis(),
  };

  return {
    EmbedBuilder: jest.fn(() => mockEmbedBuilder),
    WebhookClient: jest.fn().mockImplementation(() => ({
      send: jest.fn().mockResolvedValue(undefined),
      destroy: jest.fn(),
    })),
  };
});

describe('DiscordWebhookService', () => {
  let service: DiscordWebhookService;
  let _configsService: Mocked<IConfigsService>;
  let loggerService: Mocked<LoggerService>;
  let mockWebhookClient: jest.Mocked<WebhookClient>;

  beforeAll(async () => {
    const webhookUrl = faker.internet.url();
    const { unit, unitRef } = await TestBed.solitary(DiscordWebhookService)
      .mock(ConfigsServiceKey)
      .impl(() => ({
        DiscordWebhookConfig: { webhookUrl },
      }))
      .compile();

    service = unit;
    _configsService = unitRef.get(ConfigsServiceKey);
    loggerService = unitRef.get(LoggerService);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    service.onModuleInit();

    mockWebhookClient = (WebhookClient as unknown as jest.Mock).mock.results[0].value;
  });

  describe('onModuleInit', () => {
    it('should create a WebhookClient with the configured URL', () => {
      expect(WebhookClient).toHaveBeenCalledWith({
        url: expect.any(String),
      });
    });
  });

  describe('sendMessage', () => {
    it('should build an embed with default title "Error Report" and send it', async () => {
      const message = faker.lorem.sentence();
      await service.sendMessage(message);

      expect(mockWebhookClient.send).toHaveBeenCalledWith({
        embeds: [expect.anything()],
      });
    });

    it('should use custom title when provided', async () => {
      const message = faker.lorem.sentence();
      const customTitle = faker.lorem.words(3);
      // Reset mocks so we get a fresh EmbedBuilder
      (EmbedBuilder as unknown as jest.Mock).mockClear();
      const freshEmbed = {
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
      };
      (EmbedBuilder as unknown as jest.Mock).mockReturnValueOnce(freshEmbed);

      await service.sendMessage(message, customTitle);

      expect(freshEmbed.setTitle).toHaveBeenCalledWith(customTitle);
    });

    it('should truncate message to 1024 characters', async () => {
      const longMessage = 'a'.repeat(2000);
      (EmbedBuilder as unknown as jest.Mock).mockClear();
      const embed = {
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
      };
      (EmbedBuilder as unknown as jest.Mock).mockReturnValueOnce(embed);

      await service.sendMessage(longMessage);

      const fieldsArg = embed.addFields.mock.calls[0][0];
      expect(fieldsArg[0].value).toHaveLength(1024);
    });

    it('should add additional fields when provided', async () => {
      const message = faker.lorem.sentence();
      const title = faker.lorem.words(3);
      const fieldName = faker.lorem.word();
      const fieldValue = faker.lorem.sentence();
      (EmbedBuilder as unknown as jest.Mock).mockClear();
      const embed = {
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
      };
      (EmbedBuilder as unknown as jest.Mock).mockReturnValueOnce(embed);

      await service.sendMessage(message, title, [
        { name: fieldName, value: fieldValue, inline: true },
      ]);

      // First call: main message field; second call: additional fields
      expect(embed.addFields).toHaveBeenCalledTimes(2);
      expect(embed.addFields).toHaveBeenLastCalledWith([
        { name: fieldName, value: fieldValue, inline: true },
      ]);
    });

    it('should truncate additional field values to 1024 characters', async () => {
      const message = faker.lorem.sentence();
      const title = faker.lorem.words(3);
      const fieldName = faker.lorem.word();
      (EmbedBuilder as unknown as jest.Mock).mockClear();
      const embed = {
        setTitle: jest.fn().mockReturnThis(),
        setColor: jest.fn().mockReturnThis(),
        setTimestamp: jest.fn().mockReturnThis(),
        addFields: jest.fn().mockReturnThis(),
      };
      (EmbedBuilder as unknown as jest.Mock).mockReturnValueOnce(embed);

      const longValue = 'x'.repeat(2000);
      await service.sendMessage(message, title, [{ name: fieldName, value: longValue }]);

      const lastCall = embed.addFields.mock.calls[1][0];
      expect(lastCall[0].value).toHaveLength(1024);
    });

    it('should log error when webhook send fails', async () => {
      const message = faker.lorem.sentence();
      mockWebhookClient.send.mockRejectedValueOnce(new Error('Network error'));

      await service.sendMessage(message);

      expect(loggerService.error).toHaveBeenCalledWith(
        'sendMessage',
        expect.any(Error),
        'Failed to send Discord webhook message',
      );
    });
  });

  describe('sendErrorReport', () => {
    it('should call sendMessage with error event data', async () => {
      const errorMessage = faker.lorem.sentence();
      const errorStack = faker.lorem.lines(3);
      const errorContext = faker.lorem.word();
      const errorTimestamp = faker.date.recent().toISOString();
      const sendMessageSpy = jest.spyOn(service, 'sendMessage').mockResolvedValue(undefined);

      await service.sendErrorReport({
        message: errorMessage,
        stack: errorStack,
        context: errorContext,
        timestamp: errorTimestamp,
      });

      expect(sendMessageSpy).toHaveBeenCalledWith(errorMessage, `Error in ${errorContext}`, [
        { name: 'Stack', value: errorStack },
        { name: 'Context', value: errorContext },
        { name: 'Timestamp', value: errorTimestamp },
      ]);
    });

    it('should use fallback text when stack is empty', async () => {
      const errorMessage = faker.lorem.sentence();
      const errorContext = faker.lorem.word();
      const errorTimestamp = faker.date.recent().toISOString();
      const sendMessageSpy = jest.spyOn(service, 'sendMessage').mockResolvedValue(undefined);

      await service.sendErrorReport({
        message: errorMessage,
        stack: '',
        context: errorContext,
        timestamp: errorTimestamp,
      });

      const additionalFields = sendMessageSpy.mock.calls[0][2]!;
      expect(additionalFields[0]).toEqual({ name: 'Stack', value: 'No stack trace' });
    });
  });

  describe('onModuleDestroy', () => {
    it('should destroy the webhook client', async () => {
      await service.onModuleDestroy();

      expect(mockWebhookClient.destroy).toHaveBeenCalled();
    });
  });
});
