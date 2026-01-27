import { InputType, PartialType } from '@nestjs/graphql';
import { CreateGroupInput } from './create-group.input';

@InputType()
export class UpdateGroupInput extends PartialType(CreateGroupInput) {
  // PartialType rend tous les champs de CreateGroupInput optionnels.
}

