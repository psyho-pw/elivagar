import { NotificationType } from './notification.entity';

export interface NotificationResult {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: NotificationType;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationListResult {
  items: NotificationResult[];
  total: number;
}
