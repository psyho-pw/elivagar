import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv, getEnvInt } from '../configs.helper';
import { IAuthGrpcConfig } from '../configs.interface';

export const AuthGrpcConfigKey = 'AuthGrpc';

export const AuthGrpcConfigSchema = z.object({
  url: z.string().min(1),
}) satisfies z.ZodType<IAuthGrpcConfig>;

export const AuthGrpcConfig = registerAs(AuthGrpcConfigKey, (): IAuthGrpcConfig => {
  const host = getEnv('AUTH_GRPC_HOST', 'localhost');
  const port = getEnvInt('AUTH_GRPC_PORT', 5000);

  const config: IAuthGrpcConfig = {
    url: `${host}:${port}`,
  };

  return AuthGrpcConfigSchema.parse(config);
});
