import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  CreateBucketCommand,
  GetObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);

  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.getOrThrow<string>('S3_ENDPOINT');
    const username = this.configService.getOrThrow<string>('S3_ROOT_USER');
    const password = this.configService.getOrThrow<string>('S3_ROOT_PASSWORD');
    const region = this.configService.getOrThrow<string>('S3_REGION');
    this.bucket = this.configService.getOrThrow<string>('S3_BUCKET');

    this.client = new S3Client({
      endpoint,
      region,
      forcePathStyle: true,

      credentials: {
        accessKeyId: username,
        secretAccessKey: password,
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.ensureBucket();
  }

  private async ensureBucket(): Promise<void> {
    try {
      await this.client.send(
        new HeadBucketCommand({
          Bucket: this.bucket,
        }),
      );

      this.logger.log(`Storage bucket "${this.bucket}" is ready`);
    } catch {
      await this.client.send(
        new CreateBucketCommand({
          Bucket: this.bucket,
        }),
      );

      this.logger.log(`Created storage bucket "${this.bucket}"`);
    }
  }

  async createUploadUrl(
    key: string,
    contentType: string,
    size: number,
  ): Promise<string> {
    return getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: size,
      }),
      {
        expiresIn: 900,
      },
    );
  }

  async createDownloadUrl(key: string): Promise<string> {
    return getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
      {
        expiresIn: 900,
      },
    );
  }
}
