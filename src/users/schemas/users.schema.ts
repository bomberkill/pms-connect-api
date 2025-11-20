import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, SchemaTypes, Types } from 'mongoose';

// Enums to be used in Mongoose schema, mirroring GraphQL enums
// It's good practice to define them separately or import if they are shared
// For simplicity here, we redefine them. Ensure values match your GQL enums.

export enum UserType {
  INDIVIDUAL = 'INDIVIDUAL',
  LEGAL_ENTITY = 'LEGAL_ENTITY',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUSPENDED = 'SUSPENDED',
  DEACTIVATED = 'DEACTIVATED',
}

export enum Speciality {
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
  // Ensure this list matches SpecialityGQL
}

export enum EntityType {
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
  // Ensure this list matches EntityTypeGQL
}

@Schema({ _id: false }) // _id: false because this will be a subdocument
export class Location {
  @Prop({ type: String, trim: true })
  addressLine1?: string;

  @Prop({ type: String, trim: true })
  addressLine2?: string;

  @Prop({ type: String, trim: true })
  city?: string;

  @Prop({ type: String, trim: true })
  stateOrProvince?: string;

  @Prop({ type: String, trim: true })
  postalCode?: string;

  @Prop({ type: String, required: true, trim: true })
  country: string;
}
export const LocationSchema = SchemaFactory.createForClass(Location);

@Schema({ _id: false }) // _id: false because this will be a subdocument
export class ProfessionalAccreditation {
  @Prop({ type: String })
  accreditationType?: string;

  @Prop({ type: String })
  referenceNumber?: string;

  @Prop({ type: String, required: true }) // URL to the document
  documentUrl: string;

  @Prop({ type: Date })
  issueDate?: Date;

  @Prop({ type: Date })
  expirationDate?: Date;

  @Prop({ type: String })
  issuingAuthority?: string;
}
export const ProfessionalAccreditationSchema = SchemaFactory.createForClass(ProfessionalAccreditation);

@Schema({ timestamps: true, discriminatorKey: 'userType' })
export class User extends Document { // Extend Document for Mongoose typings
  @Prop({ type: String, required: true, unique: true, index: true })
  firebaseUid: string;

  @Prop({ type: String, required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ type: String, required: true, default: '' })
  phoneNumber: string;

  @Prop({ type: String, required: true, unique: true, index: true, trim: true })
  slug: string;

  // This is the discriminator key. It's managed by Mongoose but needs to be declared for TypeScript.
  userType: UserType;

  @Prop({ type: [ProfessionalAccreditationSchema], default: [] })
  professionalAccreditation?: ProfessionalAccreditation[];

  @Prop({ type: String })
  profilePicUrl?: string;

  @Prop({ type: String })
  coverPicUrl?: string;

  @Prop({ type: String, trim: true })
  bio?: string;

  @Prop({ type: LocationSchema })
  location?: Location;

  @Prop({ type: String })
  websiteUrl?: string;

  @Prop({ type: String, enum: Object.values(AccountStatus), required: true, default: AccountStatus.PENDING_VERIFICATION })
  accountStatus: AccountStatus;

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [] })
  connections: string[]; // Store as array of ObjectIds referencing other Users

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [] })
  followers: string[];

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [] })
  following: string[];

  @Prop({ type: [{ type: SchemaTypes.ObjectId, ref: 'User' }], default: [] })
  blockedUsers: string[];

  @Prop({ type: [String], default: [] })
  fcmTokens: string[];

  @Prop({ type: String, default: 'en' }) // Default to English
  language: string;

  // createdAt and updatedAt are handled by timestamps: true
  @Prop({ type: Date })
  lastLoginAt?: Date;

  // Add declarations for timestamp fields to satisfy TypeScript when comparing with GraphQL User model
    readonly createdAt: Date;
    readonly updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// --- Discriminator Schemas ---

@Schema()
export class IndividualUser extends User {
  @Prop({ type: String, required: true, trim: true })
  firstName: string;

  @Prop({ type: String, required: true, trim: true })
  lastName: string;

  @Prop({ type: String, enum: Object.values(Speciality), required: true })
  speciality: Speciality;

  @Prop({ type: String, trim: true })
  professionalTitle?: string;
}
export const IndividualUserSchema = SchemaFactory.createForClass(IndividualUser);

@Schema()
export class LegalEntityUser extends User {
  @Prop({ type: String, required: true, trim: true })
  entityName: string;

  @Prop({ type: String, enum: Object.values(EntityType), required: true })
  entityType: EntityType;
}
export const LegalEntityUserSchema = SchemaFactory.createForClass(LegalEntityUser);

// Export Document types for service injection

export type UserDocument = User & Document;
export type IndividualUserDocument = IndividualUser & Document;
export type LegalEntityUserDocument = LegalEntityUser & Document;