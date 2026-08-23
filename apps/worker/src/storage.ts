import {
  GetObjectCommand,
  S3Client
} from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

dotenv.config({
  path: resolve(dirname(fileURLToPath(import.meta.url)), "../../../.env")
});

const endpoint =
  process.env.MINIO_ENDPOINT ||
  `http://localhost:${Number(process.env.MINIO_API_PORT) || 9000}`;
const bucket = process.env.MINIO_BUCKET || "taskflow";

const client = new S3Client({
  endpoint,
  region: process.env.AWS_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey:
      process.env.MINIO_ROOT_PASSWORD || process.env.AWS_SECRET_ACCESS_KEY || ""
  }
});

export const readObject = async (key: string): Promise<string> => {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  if (!result.Body) {
    throw new Error(`Stored object has no body: ${key}`);
  }

  return result.Body.transformToString();
};
