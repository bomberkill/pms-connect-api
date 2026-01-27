import { ObjectType, Field, ID, registerEnumType } from '@nestjs/graphql';
import { User } from '../../users/models/users.model';
import { GroupPrivacy, GroupMemberRole } from '../schemas/group.schema';

// --- GraphQL Enums ---

registerEnumType(GroupPrivacy, {
  name: 'GroupPrivacy',
  description: 'The privacy level of a group (PUBLIC, PRIVATE, SECRET)',
});

registerEnumType(GroupMemberRole, {
  name: 'GroupMemberRole',
  description: 'The role of a member within a group (ADMIN, MODERATOR, MEMBER)',
});

// --- GraphQL Object Types ---

@ObjectType('GroupMember')
export class GroupMemberGQL {
  @Field(() => User)
  user: User; // We expose the full User object, not just the ID

  @Field(() => GroupMemberRole)
  role: GroupMemberRole;

  @Field()
  joinedAt: Date;
}

@ObjectType('Group')
export class GroupGQL {
  @Field(() => ID)
  _id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field({ nullable: true })
  description?: string;

  @Field(() => User)
  creator: User; // We expose the full User object

  @Field(() => GroupPrivacy)
  privacy: GroupPrivacy;

  @Field(() => [GroupMemberGQL])
  members: GroupMemberGQL[];

  @Field({ nullable: true })
  coverImageUrl?: string;

  @Field({ nullable: true })
  profileImageUrl?: string;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}