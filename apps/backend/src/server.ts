import { buildApp } from './app.js';
import { env } from './config/env.js';

const app = await buildApp();

try {
  await app.listen({ port: env.port, host: env.host });
  app.log.info(`Control S API Hub disponivel em ${env.appPublicUrl}`);
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
