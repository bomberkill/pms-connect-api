import { ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import { UploadPurpose } from './dto/get-upload-url.input';
import { UploadUrlResponse } from './models/upload-url.model';

const PURPOSE_PREFIXES: Record<UploadPurpose, string> = {
  [UploadPurpose.AVATAR]: 'avatars',
  [UploadPurpose.COVER_PICTURE]: 'covers',
  [UploadPurpose.POST_MEDIA]: 'posts',
  [UploadPurpose.GROUP_PICTURE]: 'groups',
  [UploadPurpose.ACCREDITATION_DOCUMENT]: 'accreditations',
};

const UPLOAD_URL_EXPIRES_IN_SECONDS = 5 * 60;

@Injectable()
export class StorageService {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    const accountId = this.configService.getOrThrow<string>('R2_ACCOUNT_ID');
    this.bucket = this.configService.getOrThrow<string>('R2_BUCKET_NAME');
    this.publicBaseUrl = this.configService
      .getOrThrow<string>('R2_PUBLIC_URL')
      .replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('R2_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.getOrThrow<string>(
          'R2_SECRET_ACCESS_KEY',
        ),
      },
    });
  }

  /**
   * Issues a presigned PUT URL so the client can upload a file directly to
   * R2 without the file ever transiting through this API.
   */
  async getUploadUrl(
    userId: string,
    purpose: UploadPurpose,
    fileName: string,
    contentType: string,
  ): Promise<UploadUrlResponse> {
    const extension = fileName.includes('.')
      ? fileName.slice(fileName.lastIndexOf('.'))
      : '';
    const key = `${PURPOSE_PREFIXES[purpose]}/${userId}/${randomUUID()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: UPLOAD_URL_EXPIRES_IN_SECONDS,
    });

    return {
      uploadUrl,
      publicUrl: `${this.publicBaseUrl}/${key}`,
      key,
    };
  }

  /**
   * Deletes a file previously uploaded via getUploadUrl. Keys are namespaced
   * as `${purpose}/${userId}/${uuid}${ext}`, so we check the userId segment
   * to ensure users can only delete their own files.
   */
  async deleteFile(key: string, requesterId: string): Promise<void> {
    const [, ownerId] = key.split('/');
    if (ownerId !== requesterId) {
      throw new ForbiddenException('You can only delete your own files.');
    }
    await this.client.send(
      new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
    );
  }
}
