import { Resolver, Mutation, Args } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BetterAuthGuard } from '../auth/guards/better-auth.guard';
import {
  CurrentUser,
  CurrentUserType,
} from '../auth/decorators/current-user.decorator';
import { StorageService } from './storage.service';
import { GetUploadUrlInput } from './dto/get-upload-url.input';
import { UploadUrlResponse } from './models/upload-url.model';

@Resolver()
export class StorageResolver {
  constructor(private readonly storageService: StorageService) {}

  @UseGuards(BetterAuthGuard)
  @Mutation(() => UploadUrlResponse, {
    name: 'getUploadUrl',
    description:
      'Returns a presigned URL to upload a file directly to Cloudflare R2.',
  })
  async getUploadUrl(
    @Args('input') input: GetUploadUrlInput,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<UploadUrlResponse> {
    // `currentUser` may be the transient `{ authUserId }` shape when this
    // runs during registration, before a Mongo profile exists — namespace
    // uploads by authUserId (present on both shapes) rather than the Mongo
    // `_id`, which may not exist yet.
    return this.storageService.getUploadUrl(
      currentUser.authUserId,
      input.purpose,
      input.fileName,
      input.contentType,
    );
  }

  @UseGuards(BetterAuthGuard)
  @Mutation(() => Boolean, {
    name: 'deleteUploadedFile',
    description: 'Deletes a file the current user previously uploaded to R2.',
  })
  async deleteUploadedFile(
    @Args('key') key: string,
    @CurrentUser() currentUser: CurrentUserType,
  ): Promise<boolean> {
    await this.storageService.deleteFile(key, currentUser.authUserId);
    return true;
  }
}
