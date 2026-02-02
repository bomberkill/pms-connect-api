import { Module } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { GroupsResolver } from './groups.resolver';
import { JoinGroupRequestsService } from './join-group-requests.service';
import { JoinGroupRequestsResolver } from './join-group-requests.resolver';
import { GroupMembershipService } from './group-membership.service';
import { MongooseModule } from '@nestjs/mongoose';
import { Group, GroupSchema } from './schemas/group.schema';
import {
  GroupJoinRequest,
  GroupJoinRequestSchema,
} from './schemas/group-join-request.schema';
import {
  GroupMembership,
  GroupMembershipSchema,
} from './schemas/group-membership.schema';
import { NotificationsModule } from '../notifications/notifications.module';
import { PubSubModule } from '../pubsub/pubsub.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Group.name, schema: GroupSchema },
      { name: GroupJoinRequest.name, schema: GroupJoinRequestSchema },
      { name: GroupMembership.name, schema: GroupMembershipSchema },
    ]),
    NotificationsModule,
    PubSubModule,
  ],
  providers: [
    GroupsService,
    GroupsResolver,
    JoinGroupRequestsService,
    JoinGroupRequestsResolver,
    GroupMembershipService,
  ],
  exports: [GroupsService, GroupMembershipService],
})
export class GroupsModule {}
