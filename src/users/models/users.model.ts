import {
  ObjectType,
  Field,
  ID,
  InterfaceType,
  registerEnumType,
  GraphQLISODateTime,
} from '@nestjs/graphql';

export enum UserTypeGQL {
  INDIVIDUAL = 'INDIVIDUAL',
  LEGAL_ENTITY = 'LEGAL_ENTITY',
}

registerEnumType(UserTypeGQL, {
  name: 'UserType',
  description: 'The type of user account: individual or legal entity.',
});

export enum AccountStatusGQL {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

registerEnumType(AccountStatusGQL, {
  name: 'AccountStatus',
  description: 'The status of the user account.',
});

export enum SpecialityGQL {
  // CARDIOLOGY = 'CARDIOLOGY',
  // NURSING = 'NURSING',
  // BIOMEDICAL_TECHNICIAN = 'BIOMEDICAL_TECHNICIAN',
  // HEALTH_ASSISTANT = 'HEALTH_ASSISTANT',
  // GENERAL_MEDICINE = 'GENERAL_MEDICINE',
  // PEDIATRICS = 'PEDIATRICS',
  // ONCOLOGY = 'ONCOLOGY',
  MEDICAL_DOCTORS = 'MEDICAL_DOCTORS',
  DENTAL_SURGEONS = 'DENTAL_SURGEONS',
  PHARMACISTS = 'PHARMACISTS',
  NURSES = 'NURSES',
  SANITARY_ENGINEERING = 'SANITARY_ENGINEERING',
  MEDICO_SANITARY_TECHNICIANS = 'MEDICO_SANITARY_TECHNICIANS',
  PUBLIC_HEALTH_ADMINISTRATION = 'PUBLIC_HEALTH_ADMINISTRATION',
  MIDWIVES = 'MIDWIVES',
  MEDICAL_REPRESENTATIVES = 'MEDICAL_REPRESENTATIVES',
  CAREGIVERS = 'CAREGIVERS',
  PHARMACY_ASSISTANTS = 'PHARMACY_ASSISTANTS',
  OTHER_HEALTH_AUXILIARY = 'OTHER_HEALTH_AUXILIARY',
  // Add other specialities as needed
}

registerEnumType(SpecialityGQL, {
  name: 'Speciality',
  description:
    'Medical specialty or field of activity for an individual professional.',
});

export enum EntityTypeGQL {
  // HOSPITAL = 'HOSPITAL',
  // CLINIC = 'CLINIC',
  // LABORATORY = 'LABORATORY',
  // PHARMACEUTICAL_COMPANY = 'PHARMACEUTICAL_COMPANY',
  // MEDICAL_ASSOCIATION = 'MEDICAL_ASSOCIATION',
  // HEALTH_TRAINING_INSTITUTION = 'HEALTH_TRAINING_INSTITUTION',
  HOSPITAL = 'HOSPITAL',
  CLINIC = 'CLINIC',
  LABORATORY = 'LABORATORY',
  PHARMACEUTICAL_COMPANY = 'PHARMACEUTICAL_COMPANY',
  MEDICAL_ASSOCIATION = 'MEDICAL_ASSOCIATION',
  HEALTH_TRAINING_INSTITUTION = 'HEALTH_TRAINING_INSTITUTION',
  COMPANY = 'COMPANY',
  IMAGING_CENTER = 'IMAGING_CENTER',
  ASSOCIATION = 'ASSOCIATION',
  // Add other entity types as needed
}

registerEnumType(EntityTypeGQL, {
  name: 'EntityType',
  description: 'Type of legal entity in the healthcare sector.',
});

@ObjectType('ProfessionalAccreditationObject', {
  description:
    'Represents a professional accreditation document or its details.',
})
export class ProfessionalAccreditationObject {
  @Field({
    nullable: true,
    description: 'Type of accreditation (e.g., Diploma, Certificate).',
  })
  accreditationType?: string;

  @Field({ nullable: true, description: 'Reference number of the document.' })
  referenceNumber?: string;

  @Field({ description: 'URL to the uploaded document.' })
  documentUrl: string;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Date of issue.',
  })
  issueDate?: Date;

  @Field(() => GraphQLISODateTime, {
    nullable: true,
    description: 'Expiration date, if applicable.',
  })
  expirationDate?: Date;

  @Field({ nullable: true, description: 'Issuing authority or institution.' })
  issuingAuthority?: string;
}

@ObjectType('LocationObject', {
  description: 'Represents a geographical location.',
})
export class LocationObject {
  @Field({ nullable: true })
  addressLine1?: string;

  @Field({ nullable: true })
  addressLine2?: string;

  @Field({ nullable: true })
  city?: string;

  @Field({ nullable: true })
  stateOrProvince?: string;

  @Field({ nullable: true })
  postalCode?: string;

  @Field()
  country: string;
}

@InterfaceType({
  description: 'Represents a user, can be an individual or a legal entity.',
  resolveType: (value) => {
    if (value.userType === UserTypeGQL.INDIVIDUAL) {
      return IndividualUserObject;
    }
    if (value.userType === UserTypeGQL.LEGAL_ENTITY) {
      return LegalEntityUserObject;
    }
    return null;
  },
})
export abstract class User {
  // Common fields for both Individual and Legal Entity
  @Field(() => ID, {
    description: 'Unique identifier for the user (MongoDB ObjectId)',
  })
  id: string;

  @Field(() => ID, {
    description: "User's unique identifier from Better Auth",
  })
  authUserId: string;

  @Field()
  email: string;

  @Field()
  phoneNumber: string;

  @Field({ description: 'The unique, URL-friendly identifier for the user.' })
  slug: string;

  @Field(() => UserTypeGQL)
  userType: UserTypeGQL;

  @Field(() => [ProfessionalAccreditationObject], {
    nullable: true,
    description: 'Professional accreditation documents or details.',
  })
  professionalAccreditation?: ProfessionalAccreditationObject[];

  @Field({ nullable: true })
  profilePicUrl?: string;

  @Field({ nullable: true })
  coverPicUrl?: string;

  @Field({ nullable: true })
  bio?: string;

  @Field(() => LocationObject, {
    nullable: true,
    description: 'User location details',
  })
  location?: LocationObject;

  @Field({ nullable: true })
  websiteUrl?: string;

  @Field(() => AccountStatusGQL)
  accountStatus: AccountStatusGQL;

  @Field(() => [ID], {
    defaultValue: [],
    description: 'List of connected user IDs',
  })
  connections: string[];

  @Field(() => [ID], {
    defaultValue: [],
    description: 'List of follower user IDs',
  })
  followers: string[];

  @Field(() => [ID], {
    defaultValue: [],
    description: 'List of user IDs this user is following',
  })
  following: string[];

  @Field(() => [ID], {
    defaultValue: [],
    description: 'List of blocked user IDs',
  })
  blockedUsers: string[];

  @Field(() => [String], { defaultValue: [] })
  fcmTokens: string[];

  @Field({ defaultValue: 'en' })
  language: string;

  @Field(() => [String], {
    description:
      'Authentication providers used by the user (e.g., password, google.com)',
  })
  providers: string[];

  @Field(() => GraphQLISODateTime)
  createdAt: Date;

  @Field(() => GraphQLISODateTime)
  updatedAt: Date;

  @Field(() => GraphQLISODateTime, { nullable: true })
  lastLoginAt?: Date;
}

@ObjectType({
  description: 'Represents an individual healthcare professional.',
  implements: () => User,
})
export class IndividualUserObject extends User {
  @Field()
  firstName: string;
  @Field()
  lastName: string;
  @Field(() => SpecialityGQL, {
    description: 'Medical specialty or field of activity',
  })
  speciality: SpecialityGQL;
  @Field({
    nullable: true,
    description: 'Professional title (e.g., Dr., Nurse)',
  })
  professionalTitle?: string;
}

@ObjectType({
  description: 'Represents a legal entity in the healthcare sector.',
  implements: () => User,
})
export class LegalEntityUserObject extends User {
  @Field({ description: 'Official name of the legal entity' })
  entityName: string;
  @Field(() => EntityTypeGQL, {
    description: 'Type of legal entity (e.g., Hospital, Clinic, Association)',
  })
  entityType: EntityTypeGQL;
}
