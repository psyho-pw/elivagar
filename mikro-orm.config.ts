import { defineConfig } from '@mikro-orm/postgresql';

const app = process.env.APP;
const env = process.env.NODE_ENV;

if (!app) {
  throw new Error('Missing required environment variable: APP');
}

if (!env) {
  throw new Error('Missing required environment variable: NODE_ENV');
}

// Validate app name
const validApps = ['auth', 'notification', 'sayho-bot'];
if (!validApps.includes(app)) {
  throw new Error(`Invalid app name: ${app}. Valid options: ${validApps.join(', ')}`);
}

// Get service-specific prefix
const getPrefix = (app: string): string => {
  return app.toUpperCase().replace(/-/g, '_') + '_';
};

// Get schema name
const getSchema = (app: string): string => {
  return app === 'sayho-bot' ? 'sayho' : app;
};

const prefix = getPrefix(app);
const schema = getSchema(app);

// Helper to get environment variable with optional prefix
const getEnv = (key: string, defaultValue?: string): string => {
  // Try prefixed version first, then fall back to non-prefixed
  const prefixedValue = process.env[`${prefix}${key}`];
  const nonPrefixedValue = process.env[key];
  return prefixedValue || nonPrefixedValue || defaultValue || '';
};

export default defineConfig({
  host: getEnv('DB_HOST', 'localhost'),
  port: parseInt(getEnv('DB_PORT', '5432')),
  user: getEnv('DB_USERNAME', 'elivagar'),
  password: getEnv('DB_PASSWORD', ''),
  dbName: getEnv('DB_DATABASE', 'elivagar'),
  schema,
  entities: [`./apps/${app}/src/**/*.entity.ts`],
  entitiesTs: [`./apps/${app}/src/**/*.entity.ts`],
  migrations: {
    tableName: 'migrations',
    path: `./libs/mikro/migrations/${app}`,
    pathTs: `./libs/mikro/migrations/${app}`,
    glob: '!(*.d).{js,ts}',
    transactional: true,
    allOrNothing: true,
    emit: 'ts',
  },
});
