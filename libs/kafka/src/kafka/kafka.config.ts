import { getEnv, getEnvBool, getEnvInt } from '@app/core/configs/configs.helper';
import { registerAs } from '@nestjs/config';
import { validate, IValidation } from 'typia';
import { IKafkaConfig } from './kafka.interface';

export const KafkaConfigKey = 'Kafka';

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

  const res: IValidation<IKafkaConfig> = validate<IKafkaConfig>(config);

  if (!res.success) {
    console.error(res.errors);
    throw new Error(KafkaConfigKey);
  }

  return res.data;
});
