import { registerAs } from '@nestjs/config';
import { validate, IValidation } from 'typia';
import { getEnv, getEnvInt } from '../configs.helper';
import { IApp } from '../configs.interface';

export const AppConfigKey = 'App';

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

  const res: IValidation<IApp> = validate<IApp>(config);

  if (!res.success) {
    console.error(res.errors);
    throw new Error(AppConfigKey);
  }

  return res.data;
});
