import { Injectable, Scope } from '@nestjs/common';
import * as DataLoader from 'dataloader';
import { UserDocument } from '../schemas/users.schema';
import { UsersService } from '../users.service';

@Injectable({ scope: Scope.REQUEST })
export class UserLoader extends DataLoader<string, UserDocument> {
  constructor(private readonly usersService: UsersService) {
    super(async (keys: readonly string[]) => {
      const users = await this.usersService.findManyByIds(keys as string[]);
      const usersMap = new Map(
        users.map((user) => [user._id.toString(), user]),
      );
      return keys.map((key) => usersMap.get(key) || null);
    });
  }
}
