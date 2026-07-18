import { Module, forwardRef } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsResolver, GroupMembershipResolver } from './groups.resolver';
import { JoinGroupRequestsService } from './join-group-requests.service';
import { JoinGroupRequestsResolver } from './join-group-requests.resolver';
import { GroupMembershipService } from './group-membership.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { PubSubModule } from '../pubsub/pubsub.module';
import { UsersModule } from '../users/users.module';

@Module({
  imports: [forwardRef(() => NotificationsModule), forwardRef(() => UsersModule), PubSubModule],
  providers: [
    GroupsService,
    GroupsResolver,
    GroupMembershipResolver,
    JoinGroupRequestsService,
    JoinGroupRequestsResolver,
    GroupMembershipService,
  ],
  exports: [GroupsService, GroupMembershipService],
})
export class GroupsModule {}
