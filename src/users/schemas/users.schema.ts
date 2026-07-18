// Thin compatibility shim: re-exports Prisma's generated User type/enums
// under the same names/import path the rest of the codebase already uses,
// so modules not yet migrated off Mongoose keep compiling unchanged while
// this module is ported. No Mongoose left here — `UserDocument` is now a
// plain Prisma row, not a Mongoose document (no `.save()`/`.populate()`).
export type { UserModel as UserDocument, UserModel as User } from '../../../generated/prisma/models';
export {
  UserType,
  AccountStatus,
  Speciality,
  EntityType,
} from '../../../generated/prisma/enums';
