import { status } from '@grpc/grpc-js';
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RpcException } from '@nestjs/microservices';
import { GRPC_THROTTLE_KEY, GrpcThrottleOptions } from './grpc-throttle.decorator';

interface ThrottleEntry {
  count: number;
  resetAt: number;
}

const CLEANUP_INTERVAL = 60_000;

@Injectable()
export class GrpcThrottleGuard implements CanActivate {
  private readonly store = new Map<string, ThrottleEntry>();
  private lastCleanup = Date.now();

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'rpc') {
      return true;
    }
    GRPC_THROTTLE_KEY;

    const options = this.reflector.get<GrpcThrottleOptions | undefined>(
      GRPC_THROTTLE_KEY,
      context.getHandler(),
    );

    if (!options) {
      return true;
    }

    const now = Date.now();
    this.cleanup(now);

    const clientIp = this.getClientIp(context);
    const key = `${context.getHandler().name}:${clientIp}`;

    const entry = this.store.get(key);

    if (!entry || now >= entry.resetAt) {
      this.store.set(key, { count: 1, resetAt: now + options.ttlSeconds * 1000 });
      return true;
    }

    if (entry.count >= options.limit) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000);
      throw new RpcException({
        code: status.RESOURCE_EXHAUSTED,
        message: `Rate limit exceeded. Try again in ${retryAfter}s`,
      });
    }

    entry.count++;
    return true;
  }

  private cleanup(now: number): void {
    if (now - this.lastCleanup < CLEANUP_INTERVAL) {
      return;
    }

    this.lastCleanup = now;
    for (const [key, entry] of this.store) {
      if (now >= entry.resetAt) {
        this.store.delete(key);
      }
    }
  }

  private getClientIp(context: ExecutionContext): string {
    try {
      const rpcContext = context.switchToRpc();
      const metadata = rpcContext.getContext();

      if (metadata?.get) {
        const peer = metadata.get('peer');
        if (peer?.length) {
          return String(peer[0]);
        }
      }
    } catch {
      // fallback to unknown
    }

    return 'unknown';
  }
}
