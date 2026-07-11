import { ObjectType, Field } from '@nestjs/graphql';

@ObjectType()
export class UploadUrlResponse {
  @Field({
    description:
      'Presigned URL to PUT the file directly to Cloudflare R2. Expires shortly after issuance.',
  })
  uploadUrl: string;

  @Field({
    description: 'Public URL the file will be reachable at once uploaded.',
  })
  publicUrl: string;

  @Field({
    description: 'Object key (path) the file was stored under in the bucket.',
  })
  key: string;
}
