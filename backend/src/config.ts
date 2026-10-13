export type AppConfig = {
  nodeEnv: string;
  port: number;
  jwtSecret: string;
  databaseUrl?: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AppConfig {
  const nodeEnv = env.NODE_ENV ?? 'development';
  const jwtSecret = env.JWT_SECRET ?? 'luminex-local-development-secret';

  if (nodeEnv === 'production' && (jwtSecret === 'luminex-local-development-secret' || jwtSecret.length < 32)) {
    throw new Error('JWT_SECRET must be a unique value with at least 32 characters in production');
  }

  return {
    nodeEnv,
    port: Number(env.PORT ?? 5000),
    jwtSecret,
    databaseUrl: env.DATABASE_URL
  };
}
