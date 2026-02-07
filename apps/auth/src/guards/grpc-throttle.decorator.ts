import { CustomDecorator, SetMetadata } from '@nestjs/common';

export const GRPC_THROTTLE_KEY = Symbol('GRPC_THROTTLE');

export interface GrpcThrottleOptions {
  limit: number;
  ttlSeconds: number;
}

export const GrpcThrottle = (limit: number, ttlSeconds: number): CustomDecorator<symbol> =>
  SetMetadata<symbol, GrpcThrottleOptions>(GRPC_THROTTLE_KEY, { limit, ttlSeconds });
