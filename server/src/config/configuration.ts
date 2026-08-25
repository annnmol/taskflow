export default () => ({
  NODE_ENV: process.env.NODE_ENV,
  PROJECT_NAME: process.env.PROJECT_NAME,
  PORT: Number(process.env.PORT ?? 3000),
  CORS_ORIGIN: process.env.CORS_ORIGIN,

  POSTGRES_HOST: process.env.POSTGRES_HOST ?? 'localhost',
  POSTGRES_USER: process.env.POSTGRES_USER,
  POSTGRES_PASSWORD: process.env.POSTGRES_PASSWORD,
  POSTGRES_DB: process.env.POSTGRES_DB,
  POSTGRES_PORT: Number(process.env.POSTGRES_PORT ?? 5432),

  REDIS_USERNAME: process.env.REDIS_USERNAME,
  REDIS_PASSWORD: process.env.REDIS_PASSWORD,
  REDIS_HOST: process.env.REDIS_HOST ?? 'localhost',
  REDIS_PORT: Number(process.env.REDIS_PORT ?? 6379),

  S3_ROOT_USER: process.env.S3_ROOT_USER,
  S3_ROOT_PASSWORD: process.env.S3_ROOT_PASSWORD,
  S3_ENDPOINT: process.env.S3_ENDPOINT,
  S3_REGION: process.env.S3_REGION,
  S3_BUCKET: process.env.S3_BUCKET,

  AWS_REGION: process.env.AWS_REGION,
  AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY,

  LOCALSTACK_DEBUG: process.env.LOCALSTACK_DEBUG === 'true',
});
