import { NotificationType } from './notification.constant';

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
