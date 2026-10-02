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
  tokenHashPepper: process.env.TOKEN_HASH_PEPPER ?? 'desenvolvimento',
  credentialsMasterKey: process.env.CREDENTIALS_MASTER_KEY ?? '',
  integrationTimeoutMs: Number(process.env.INTEGRATION_TIMEOUT_MS ?? 30000),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  notificationFromEmail: process.env.NOTIFICATION_FROM_EMAIL ?? 'notificacao@controlsone.com.br'
  ,gmobiiDocumentationPath: process.env.GMOBII_DOCUMENTATION_PATH ?? 'C:\\Users\\chris\\Desktop\\Serviços\\Documentacao GMOBII 1.2.pdf'
  ,gmobiiCancellationDocumentationPath: process.env.GMOBII_CANCELLATION_DOCUMENTATION_PATH ?? 'C:\\Users\\chris\\.codex\\codex-remote-attachments\\01a0d46e-7fb3-7f82-9a3c-eb557e7bc121\\5AE99705-3280-40AD-8A8B-36E1C7A085CB\\1-Documentação-excluir-ou-devolver-pedido.pdf'
  ,gmobiiApprovalDocumentationPath: process.env.GMOBII_APPROVAL_DOCUMENTATION_PATH ?? 'C:\\Users\\chris\\Desktop\\Serviços\\Documentacao GMOBII 1.2 - Aprovação.pdf'
  ,gmobiiVideosPath: process.env.GMOBII_VIDEOS_PATH ?? 'C:\\Control S API Hub\\videos\\GMOBii'
};
