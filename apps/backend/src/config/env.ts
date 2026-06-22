import 'dotenv/config';

export const env = {
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3335),
  host: process.env.HOST ?? '0.0.0.0',
  appPublicUrl: process.env.APP_PUBLIC_URL ?? 'http://localhost:3335',
  portalPublicUrl: process.env.PORTAL_PUBLIC_URL ?? 'http://localhost:5173',
  productDatabaseProvider: process.env.PRODUCT_DATABASE_PROVIDER ?? 'postgres',
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://postgres:controls@localhost:5432/control_s_api_hub',
  jwtSecret: process.env.JWT_SECRET ?? 'desenvolvimento',
  tokenHashPepper: process.env.TOKEN_HASH_PEPPER ?? 'desenvolvimento'
};
