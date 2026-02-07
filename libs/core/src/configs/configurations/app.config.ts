import { registerAs } from '@nestjs/config';
import { z } from 'zod';
import { getEnv, getEnvInt } from '../configs.helper';
import { IApp } from '../configs.interface';

export const AppConfigKey = 'App';

export const AppConfigSchema = z.object({
  env: z.enum(['test', 'local', 'production']),
  port: z.number().int(),
  grpcPort: z.number().int(),
  serviceName: z.string().min(1),
  jwtSecret: z.string().min(1),
  jwtRefreshSecret: z.string().min(1),
  jwtAlgorithm: z.enum([
    'HS256',
    'HS384',
    'HS512',
    'RS256',
    'RS384',
    'RS512',
    'ES256',
    'ES384',
    'ES512',
    'PS256',
    'PS384',
    'PS512',
    'none',
  ]),
  jwtExpire: z.number().int().min(0),
  jwtRefreshExpire: z.number().int().min(0),
  jwtIssuer: z.string().min(1),
  clientURI: z.string().min(1),
}) satisfies z.ZodType<IApp>;

export const AppConfig = registerAs(AppConfigKey, (): IApp => {
  const config = {
    env: process.env.NODE_ENV, // NODE_ENV is not prefixed (global)
    serviceName: getEnv('SERVICE_NAME'), // Will use prefixed version if available
    port: getEnvInt('PORT', 3000),
    grpcPort: getEnvInt('GRPC_PORT', 5000),
    jwtSecret: getEnv('JWT_SECRET'),
    jwtRefreshSecret: getEnv('JWT_REFRESH_SECRET'),
    jwtAlgorithm: getEnv('JWT_ALGORITHM'),
    jwtExpire: getEnvInt('JWT_EXPIRE', 3600),
    jwtRefreshExpire: getEnvInt('JWT_REFRESH_EXPIRE', 604800),
    jwtIssuer: getEnv('JWT_ISSUER'),
    clientURI: getEnv('CLIENT_URI'),
  };

  const res = AppConfigSchema.safeParse(config);

  if (!res.success) {
    throw new Error(`${AppConfigKey} config validation failed: ${JSON.stringify(res.error.issues)}`);
  }

  return res.data;
});
