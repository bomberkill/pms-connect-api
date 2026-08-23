import { Field, InputType, registerEnumType } from '@nestjs/graphql';
import { IsEnum, IsNotEmpty, IsString, Matches } from 'class-validator';

export enum UploadPurpose {
  AVATAR = 'AVATAR',
  COVER_PICTURE = 'COVER_PICTURE',
  POST_MEDIA = 'POST_MEDIA',
  GROUP_PICTURE = 'GROUP_PICTURE',
  ACCREDITATION_DOCUMENT = 'ACCREDITATION_DOCUMENT',
}

registerEnumType(UploadPurpose, { name: 'UploadPurpose' });

@InputType()
export class GetUploadUrlInput {
  @Field(() => UploadPurpose)
  @IsEnum(UploadPurpose)
  purpose: UploadPurpose;

  @Field({ description: 'Original file name, used to derive an extension.' })
  @IsNotEmpty()
  @IsString()
  fileName: string;

  @Field({ description: 'MIME type of the file, e.g. "image/png".' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+$/, {
    message: 'contentType must be a valid MIME type.',
  })
  contentType: string;
}
