// Thin compatibility shim — see users.schema.ts for rationale.
// Every current query populates both requester and recipient (the old
// Mongoose `.populate('requester recipient')` pattern), so the type
// reflects that rather than Prisma's scalar-only default selection.
import type {
  ConnectionRequestModel,
  UserModel,
} from '../../../generated/prisma/models';

export type ConnectionRequestDocument = ConnectionRequestModel & {
  requester: UserModel;
  recipient: UserModel;
};
export { ConnectionRequestStatus } from '../../../generated/prisma/enums';
