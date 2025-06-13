export interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'error' | 'success';
  timestamp: Date;
}

export class NotificationService {
  private notifications: Notification[] = [];

  notify(notification: Omit<Notification, 'id' | 'timestamp'>): void {
    this.notifications.push({
      ...notification,
      id: Date.now().toString(),
      timestamp: new Date()
    });
  }

  getNotifications(): Notification[] {
    return this.notifications;
  }
}
