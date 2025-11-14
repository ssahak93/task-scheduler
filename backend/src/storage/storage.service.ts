import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, GetObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class StorageService implements OnModuleInit {
  private readonly logger = new Logger(StorageService.name);
  private s3Client: S3Client; // For internal operations (upload, bucket management)
  private publicS3Client: S3Client; // For generating presigned URLs with public endpoint
  private bucketName: string;
  private publicEndpoint: string;
  private usePresignedUrls: boolean;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Internal endpoint (for backend operations)
    const internalEndpoint = this.configService.get<string>('MINIO_ENDPOINT') || 'minio';
    const port = this.configService.get<number>('MINIO_PORT', 9000);
    const useSSL = this.configService.get<string>('MINIO_USE_SSL') === 'true';
    const accessKey = this.configService.get<string>('MINIO_ACCESS_KEY') || 'minioadmin';
    const secretKey = this.configService.get<string>('MINIO_SECRET_KEY') || 'minioadmin123';
    this.bucketName = this.configService.get<string>('MINIO_BUCKET') || 'chat-uploads';
    
    // Public endpoint (for browser access)
    this.publicEndpoint = this.configService.get<string>('MINIO_PUBLIC_ENDPOINT') || 'http://localhost:9000';
    this.usePresignedUrls = this.configService.get<string>('MINIO_USE_PRESIGNED', 'true') === 'true';

    const internalEndpointUrl = `${useSSL ? 'https' : 'http'}://${internalEndpoint}:${port}`;

    // S3Client for internal operations (upload, bucket management)
    this.s3Client = new S3Client({
      endpoint: internalEndpointUrl,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    // S3Client for presigned URLs (uses public endpoint)
    this.publicS3Client = new S3Client({
      endpoint: this.publicEndpoint,
      region: 'us-east-1',
      credentials: {
        accessKeyId: accessKey,
        secretAccessKey: secretKey,
      },
      forcePathStyle: true,
    });

    // Initialize bucket
    try {
      await this.ensureBucketExists();
      this.logger.log(`MinIO storage initialized. Bucket: ${this.bucketName}, Public endpoint: ${this.publicEndpoint}`);
    } catch (error: any) {
      this.logger.error(`Failed to initialize MinIO: ${error.message}`);
    }
  }

  private async ensureBucketExists() {
    try {
      await this.s3Client.send(new HeadBucketCommand({ Bucket: this.bucketName }));
      this.logger.log(`Bucket ${this.bucketName} already exists`);
    } catch (error: any) {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
        try {
          await this.s3Client.send(new CreateBucketCommand({ Bucket: this.bucketName }));
          this.logger.log(`Created bucket: ${this.bucketName}`);
        } catch (createError: any) {
          this.logger.warn(`Failed to create bucket: ${createError.message}`);
          throw createError;
        }
      } else {
        throw error;
      }
    }

    // Try to set bucket policy for public read (optional, presigned URLs work without it)
    await this.setBucketPolicy();
  }

  private async setBucketPolicy() {
    try {
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Sid: 'PublicReadGetObject',
            Effect: 'Allow',
            Principal: '*',
            Action: 's3:GetObject',
            Resource: `arn:aws:s3:::${this.bucketName}/*`,
          },
        ],
      };

      await this.s3Client.send(
        new PutBucketPolicyCommand({
          Bucket: this.bucketName,
          Policy: JSON.stringify(policy),
        })
      );
      this.logger.log(`Bucket policy set for public read access`);
    } catch (error: any) {
      // Not critical - presigned URLs will work anyway
      this.logger.debug(`Bucket policy not set (using presigned URLs): ${error.message}`);
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string = 'chat'): Promise<string> {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const extension = file.originalname.split('.').pop() || 'bin';
    const fileName = `${folder}/${uniqueSuffix}.${extension}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
        Body: file.buffer,
        ContentType: file.mimetype,
      })
    );

    return fileName;
  }

  async getFileUrl(fileName: string, expiresIn: number = 604800): Promise<string> {
    // Always use presigned URLs for security and reliability
    if (this.usePresignedUrls) {
      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fileName,
      });
      return await getSignedUrl(this.publicS3Client, command, { expiresIn });
    }

    // Fallback: direct URL (requires public bucket)
    return `${this.publicEndpoint}/${this.bucketName}/${fileName}`;
  }
}
