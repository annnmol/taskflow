import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { resolve } from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: resolve(process.cwd(), ".env") });

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

export const initializeStorage = async () => {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
};

export const createUploadUrl = async (
  key: string,
  contentType: string,
  size: number
): Promise<string> =>
  getSignedUrl(
    client,
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size
    }),
    { expiresIn: 900 }
  );

export const createDownloadUrl = async (key: string): Promise<string> =>
  getSignedUrl(
    client,
    new GetObjectCommand({ Bucket: bucket, Key: key }),
    { expiresIn: 900 }
  );
