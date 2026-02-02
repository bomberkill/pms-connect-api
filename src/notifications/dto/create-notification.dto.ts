import { NotificationType } from '../schemas/notification.schema';

export interface CreateNotificationDto {
  recipients: string[]; // Changed to an array
  sender: string;
  type: NotificationType;
  entityId?: string;
  onModel?: 'Post' | 'User' | 'Comment' | 'Group';
}
