import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import "./env.js";

const endpoint = process.env.S3_ENDPOINT || `http://localhost:9000`;
const bucket = process.env.S3_BUCKET;

const client = new S3Client({
  endpoint,
  region: process.env.AWS_REGION || "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.S3_ROOT_USER || "",
    secretAccessKey: process.env.S3_ROOT_PASSWORD || "",
  },
});

export const readObject = async (key: string): Promise<string> => {
  const result = await client.send(
    new GetObjectCommand({ Bucket: bucket, Key: key }),
  );
  if (!result.Body) {
    throw new Error(`Stored object has no body: ${key}`);
  }

  return result.Body.transformToString();
};
