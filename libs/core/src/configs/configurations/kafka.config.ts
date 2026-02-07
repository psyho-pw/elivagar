import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv, getEnvBool, getEnvInt } from '../configs.helper';
import { IKafkaConfig } from '../configs.interface';

export const KafkaConfigKey = 'Kafka';

export const KafkaConfigSchema = z.object({
  brokers: z.array(z.string().min(1)),
  clientId: z.string().min(1),
  groupId: z.string().min(1),
  ssl: z.boolean(),
  saslMechanism: z.enum(['plain', 'scram-sha-256', 'scram-sha-512']).optional(),
  saslUsername: z.string().optional(),
  saslPassword: z.string().optional(),
  connectionTimeout: z.number().int().min(0).optional(),
  requestTimeout: z.number().int().min(0).optional(),
}) satisfies z.ZodType<IKafkaConfig>;

export const KafkaConfig = registerAs(KafkaConfigKey, (): IKafkaConfig => {
  const serviceName = getEnv('SERVICE_NAME', 'elivagar');

  const config = {
    brokers: getEnv('KAFKA_BROKERS', 'localhost:9092').split(','),
    clientId: getEnv('KAFKA_CLIENT_ID', serviceName),
    groupId: getEnv('KAFKA_GROUP_ID', `${serviceName}-group`),
    ssl: getEnvBool('KAFKA_SSL', false),
    saslMechanism: getEnv('KAFKA_SASL_MECHANISM') || undefined,
    saslUsername: getEnv('KAFKA_SASL_USERNAME') || undefined,
    saslPassword: getEnv('KAFKA_SASL_PASSWORD') || undefined,
    connectionTimeout: getEnvInt('KAFKA_CONNECTION_TIMEOUT', 3000),
    requestTimeout: getEnvInt('KAFKA_REQUEST_TIMEOUT', 30000),
  };

  const res = KafkaConfigSchema.safeParse(config);

  if (!res.success) {
    throw new Error(`${KafkaConfigKey} config validation failed: ${JSON.stringify(res.error.issues)}`);
  }

  return res.data;
});
