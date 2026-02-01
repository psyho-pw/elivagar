/**
 * Environment Variable Helper
 * Handles prefixed environment variables for multi-service configuration
 */

/**
 * Get service prefix based on SERVICE_NAME
 * Maps service names to their environment variable prefixes
 */
export function getServicePrefix(): string {
  const serviceName = process.env.SERVICE_NAME || '';

  const prefixMap: Record<string, string> = {
    auth: 'AUTH_',
    notification: 'NOTIFICATION_',
    'sayho-bot': 'SAYHO_BOT_',
  };

  return prefixMap[serviceName] || '';
}

/**
 * Get environment variable with optional service prefix
 * Tries prefixed version first, then falls back to non-prefixed
 *
 * @param key - Environment variable key (without prefix)
 * @param defaultValue - Default value if not found
 * @returns Environment variable value or default
 *
 */
export function getEnv(key: string, defaultValue?: string): string {
  const prefix = getServicePrefix();

  // Try prefixed version first
  const prefixedValue = process.env[`${prefix}${key}`];
  if (prefixedValue !== undefined) {
    return prefixedValue;
  }

  // Fall back to non-prefixed
  const nonPrefixedValue = process.env[key];
  if (nonPrefixedValue !== undefined) {
    return nonPrefixedValue;
  }

  // Return default or empty string
  return defaultValue || '';
}

/**
 * Get environment variable as integer
 */
export function getEnvInt(key: string, defaultValue?: number): number {
  const value = getEnv(key, defaultValue?.toString());
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue || 0 : parsed;
}

/**
 * Get environment variable as boolean
 */
export function getEnvBool(key: string, defaultValue?: boolean): boolean {
  const value = getEnv(key, defaultValue?.toString());
  return value === 'true' || value === '1';
}
