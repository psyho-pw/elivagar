import { registerAs } from '@nestjs/config';
import { validate, IValidation } from 'typia';
import { IApp } from '../configs.interface';

export const AppConfigKey = 'App';

export const AppConfig = registerAs(AppConfigKey, (): IApp => {
  const config = {
    env: process.env.NODE_ENV,
    serviceName: process.env.SERVICE_NAME,
    port: process.env.PORT ? parseInt(process.env.PORT) : 3000,
    grpcPort: process.env.GRPC_PORT ? parseInt(process.env.GRPC_PORT) : 5000,
    jwtSecret: process.env.JWT_SECRET,
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
    jwtAlgorithm: process.env.JWT_ALGORITHM,
    jwtExpire: process.env.JWT_EXPIRE ? parseInt(process.env.JWT_EXPIRE) : 3600,
    jwtRefreshExpire: process.env.JWT_REFRESH_EXPIRE
      ? parseInt(process.env.JWT_REFRESH_EXPIRE)
      : 604800,
    jwtIssuer: process.env.JWT_ISSUER,
    clientURI: process.env.CLIENT_URI,
  };

  const res: IValidation<IApp> = validate<IApp>(config);

  if (!res.success) {
    console.error(res.errors);
    throw new Error(AppConfigKey);
  }

  return res.data;
});
