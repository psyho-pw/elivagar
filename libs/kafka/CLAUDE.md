# libs/kafka

Kafka producer/consumer with `IManagedConnection` implementation (retry + drain with 10s timeout).

## Key Features

- `getConsumerOptions()` / `getExceptionFilterProvider()` for consumer setup
- Auto-propagates `x-request-id` via CLS
- Topic convention: `{service}.{entity}.{action}`, constants in `KafkaTopics.{Service}.{Event}`

## Registration

```typescript
KafkaModule.registerAsync({
  useFactory: (c) => ({ brokers: c.KafkaConfig.brokers }),
  inject: [ConfigsServiceKey],
})
```
