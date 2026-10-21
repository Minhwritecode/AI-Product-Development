export type AppConfig = {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  databaseUrl?: string;
  databaseSsl: boolean;
  databaseSslRejectUnauthorized: boolean;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const jwtSecret = env.JWT_SECRET ?? 'luminex-local-development-secret';
  const databaseUrl = env.DATABASE_URL?.trim() || undefined;
  const databaseSsl = env.DATABASE_SSL !== 'false';
  const databaseSslRejectUnauthorized = env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false';

  if (nodeEnv === 'production' && (jwtSecret === 'luminex-local-development-secret' || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET must be a unique value with at least 32 characters in production');
  }

  if (nodeEnv === 'production' && !databaseUrl) {
    throw new Error('DATABASE_URL must point to the managed PostgreSQL instance in production');
  }

  return {
    nodeEnv,
    port: Number(env.PORT ?? 5000),
    jwtSecret,
    databaseUrl,
    databaseSsl,
    databaseSslRejectUnauthorized
  };
}
