/**
 * User Notification Service
 * Provides clear, actionable status communication to users
 */

import { EventEmitter } from 'events';
import { Logger } from '@/src/lib/logging/Logger';
import { toast } from '@/src/lib/toast';

export enum NotificationType {
  SUCCESS = 'success',
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info',
  PROGRESS = 'progress'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface NotificationOptions {
  id?: string;
  title: string;
  message: string;
  type: NotificationType;
  priority: NotificationPriority;
  duration?: number; // milliseconds, -1 for persistent
  action?: {
    label: string;
    callback: () => void;
  };
  progress?: {
    current: number;
    total: number;
    message?: string;
  };
  metadata?: Record<string, any>;
  dismissible?: boolean;
  sound?: boolean;
  vibrate?: boolean;
}

export interface NotificationStatus {
  id: string;
  shown: boolean;
  dismissed: boolean;
  clickedAction: boolean;
  shownAt?: string;
  dismissedAt?: string;
  autoDismissed: boolean;
}

export interface ErrorNotificationContext {
  errorCode: string;
  operation: string;
  retryCount?: number;
  isRetrying?: boolean;
  willRetry?: boolean;
  nextRetryIn?: number; // milliseconds
  recommendation?: string;
}

export interface RecoveryNotification {
  errorId: string;
  recoveryStatus: 'attempting' | 'succeeded' | 'failed';
  recoveryMethod: string;
  duration?: number;
  details?: string;
}

export class UserNotificationService extends EventEmitter {
  private readonly logger: Logger;
  private readonly notifications: Map<string, NotificationStatus> = new Map();
  private readonly activeNotifications: Set<string> = new Set();
  private readonly notificationQueue: NotificationOptions[] = [];
  private readonly maxActiveNotifications = 3;
  private readonly errorContextMap: Map<string, ErrorNotificationContext> = new Map();
  
  // Notification templates
  private readonly templates = {
    error: {
      network: {
        title: 'Connection Error',
        message: 'Unable to connect to the server. Please check your internet connection.'
      },
      timeout: {
        title: 'Request Timeout',
        message: 'The operation took too long to complete. Please try again.'
      },
      permission: {
        title: 'Permission Denied',
        message: 'You don\'t have permission to perform this action.'
      },
      validation: {
        title: 'Invalid Input',
        message: 'Please check your input and try again.'
      }
    },
    recovery: {
      attempting: {
        title: 'Attempting Recovery',
        message: 'We\'re working to resolve the issue automatically...'
      },
      succeeded: {
        title: 'Issue Resolved',
        message: 'The issue has been resolved successfully.'
      },
      failed: {
        title: 'Recovery Failed',
        message: 'Unable to resolve the issue automatically. Manual intervention may be required.'
      }
    },
    system: {
      degraded: {
        title: 'Performance Degraded',
        message: 'System performance is currently degraded. Some features may be slower than usual.'
      },
      critical: {
        title: 'System Critical',
        message: 'Critical system issue detected. Please save your work.'
      },
      maintenance: {
        title: 'Maintenance Mode',
        message: 'The system is undergoing maintenance. Some features may be unavailable.'
      }
    }
  };

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  /**
   * Show a notification to the user
   */
  async notify(options: NotificationOptions): Promise<string> {
    const notificationId = options.id || this.generateNotificationId();
    
    // Create notification status
    const status: NotificationStatus = {
      id: notificationId,
      shown: false,
      dismissed: false,
      clickedAction: false,
      autoDismissed: false
    };
    
    this.notifications.set(notificationId, status);
    
    // Queue if too many active notifications
    if (this.activeNotifications.size >= this.maxActiveNotifications && 
        options.priority !== NotificationPriority.CRITICAL) {
      this.notificationQueue.push({ ...options, id: notificationId });
      return notificationId;
    }
    
    // Show notification
    await this.showNotification({ ...options, id: notificationId });
    
    return notificationId;
  }

  /**
   * Show an error notification with context
   */
  async notifyError(
    error: Error,
    context: ErrorNotificationContext
  ): Promise<string> {
    const template = this.getErrorTemplate(context.errorCode);
    const notificationId = this.generateNotificationId();
    
    // Store error context for recovery notifications
    this.errorContextMap.set(notificationId, context);
    
    let message = template.message.replace('{error}', error.message);
    
    // Add retry information
    if (context.isRetrying) {
      message += `\n\nRetrying... (Attempt ${context.retryCount})`;
    } else if (context.willRetry) {
      const seconds = Math.ceil((context.nextRetryIn || 0) / 1000);
      message += `\n\nWill retry in ${seconds} seconds`;
    }
    
    // Add recommendation
    if (context.recommendation) {
      message += `\n\n${context.recommendation}`;
    }
    
    const options: NotificationOptions = {
      id: notificationId,
      title: template.title,
      message,
      type: NotificationType.ERROR,
      priority: this.getErrorPriority(context.errorCode),
      duration: context.willRetry ? -1 : 10000, // Persistent if retrying
      dismissible: !context.isRetrying
    };
    
    // Add retry action if not auto-retrying
    if (!context.willRetry && !context.isRetrying) {
      options.action = {
        label: 'Retry',
        callback: () => {
          this.emit('retryRequested', { errorId: notificationId, context });
        }
      };
    }
    
    await this.notify(options);
    
    return notificationId;
  }

  /**
   * Show a recovery notification
   */
  async notifyRecovery(recovery: RecoveryNotification): Promise<void> {
    const template = this.templates.recovery[recovery.recoveryStatus];
    const errorContext = this.errorContextMap.get(recovery.errorId);
    
    // Dismiss the original error notification if recovery succeeded
    if (recovery.recoveryStatus === 'succeeded' && errorContext) {
      await this.dismiss(recovery.errorId);
      this.errorContextMap.delete(recovery.errorId);
    }
    
    let message = template.message;
    if (recovery.details) {
      message += `\n\n${recovery.details}`;
    }
    
    if (recovery.duration) {
      message += `\n\nCompleted in ${(recovery.duration / 1000).toFixed(1)}s`;
    }
    
    await this.notify({
      title: template.title,
      message,
      type: recovery.recoveryStatus === 'succeeded' 
        ? NotificationType.SUCCESS 
        : recovery.recoveryStatus === 'attempting'
        ? NotificationType.INFO
        : NotificationType.WARNING,
      priority: NotificationPriority.MEDIUM,
      duration: recovery.recoveryStatus === 'attempting' ? -1 : 5000
    });
  }

  /**
   * Show a system health notification
   */
  async notifySystemHealth(
    status: 'healthy' | 'degraded' | 'critical',
    details?: string
  ): Promise<void> {
    if (status === 'healthy') {
      // Don't notify for healthy status unless recovering from issue
      return;
    }
    
    const template = this.templates.system[status];
    let message = template.message;
    
    if (details) {
      message += `\n\n${details}`;
    }
    
    await this.notify({
      title: template.title,
      message,
      type: status === 'critical' ? NotificationType.ERROR : NotificationType.WARNING,
      priority: status === 'critical' ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
      duration: -1, // Persistent for health issues
      dismissible: false,
      sound: status === 'critical',
      vibrate: status === 'critical'
    });
  }

  /**
   * Show a progress notification
   */
  async notifyProgress(
    title: string,
    current: number,
    total: number,
    message?: string
  ): Promise<string> {
    const notificationId = `progress_${Date.now()}`;
    
    await this.notify({
      id: notificationId,
      title,
      message: message || `Processing... ${current}/${total}`,
      type: NotificationType.PROGRESS,
      priority: NotificationPriority.LOW,
      duration: -1, // Persistent until complete
      progress: { current, total, message },
      dismissible: false
    });
    
    // Auto-dismiss when complete
    if (current >= total) {
      setTimeout(() => {
        this.dismiss(notificationId);
      }, 2000);
    }
    
    return notificationId;
  }

  /**
   * Update an existing notification
   */
  async update(
    notificationId: string,
    updates: Partial<NotificationOptions>
  ): Promise<void> {
    const status = this.notifications.get(notificationId);
    if (!status || status.dismissed) {
      return;
    }
    
    // Update notification in UI
    if (this.activeNotifications.has(notificationId)) {
      // In real implementation, would update the toast
      this.logger.info('Updating notification', { notificationId, updates });
    }
    
    // Update progress notifications
    if (updates.progress) {
      const { current, total } = updates.progress;
      if (current >= total) {
        setTimeout(() => this.dismiss(notificationId), 2000);
      }
    }
  }

  /**
   * Dismiss a notification
   */
  async dismiss(notificationId: string): Promise<void> {
    const status = this.notifications.get(notificationId);
    if (!status || status.dismissed) {
      return;
    }
    
    status.dismissed = true;
    status.dismissedAt = new Date().toISOString();
    this.activeNotifications.delete(notificationId);
    
    // Show next queued notification
    this.processQueue();
    
    this.emit('dismissed', { notificationId });
  }

  /**
   * Dismiss all notifications
   */
  async dismissAll(type?: NotificationType): Promise<void> {
    const notificationIds = Array.from(this.activeNotifications);
    
    for (const id of notificationIds) {
      const notification = this.notifications.get(id);
      if (!type || notification) {
        await this.dismiss(id);
      }
    }
  }

  /**
   * Show the actual notification
   */
  private async showNotification(options: NotificationOptions): Promise<void> {
    const status = this.notifications.get(options.id!)!;
    
    // Mark as active
    this.activeNotifications.add(options.id!);
    status.shown = true;
    status.shownAt = new Date().toISOString();
    
    // Show toast notification
    const toastOptions: any = {
      duration: options.duration === -1 ? Infinity : (options.duration || 5000),
      dismissible: options.dismissible !== false,
      action: options.action ? {
        label: options.action.label,
        onClick: () => {
          options.action!.callback();
          status.clickedAction = true;
          this.emit('actionClicked', { notificationId: options.id });
        }
      } : undefined
    };
    
    // Show based on type
    switch (options.type) {
      case NotificationType.SUCCESS:
        toast.success(options.message, { ...toastOptions, title: options.title });
        break;
      case NotificationType.ERROR:
        toast.error(options.message, { ...toastOptions, title: options.title });
        break;
      case NotificationType.WARNING:
        toast.warning(options.message, { ...toastOptions, title: options.title });
        break;
      case NotificationType.PROGRESS:
        toast.loading(options.message, { ...toastOptions, title: options.title });
        break;
      default:
        toast(options.message, { ...toastOptions, title: options.title });
    }
    
    // Play sound if requested
    if (options.sound) {
      this.playNotificationSound(options.type);
    }
    
    // Vibrate if requested and supported
    if (options.vibrate && 'vibrate' in navigator) {
      navigator.vibrate(200);
    }
    
    // Auto-dismiss if duration is set
    if (options.duration && options.duration > 0) {
      setTimeout(() => {
        const currentStatus = this.notifications.get(options.id!);
        if (currentStatus && !currentStatus.dismissed) {
          currentStatus.autoDismissed = true;
          this.dismiss(options.id!);
        }
      }, options.duration);
    }
    
    // Emit event
    this.emit('shown', { notification: options });
    
    // Log notification
    this.logger.info('Notification shown', {
      id: options.id,
      type: options.type,
      priority: options.priority,
      title: options.title
    });
  }

  /**
   * Process notification queue
   */
  private processQueue(): void {
    while (this.activeNotifications.size < this.maxActiveNotifications && 
           this.notificationQueue.length > 0) {
      const notification = this.notificationQueue.shift()!;
      this.showNotification(notification);
    }
  }

  /**
   * Get error template
   */
  private getErrorTemplate(errorCode: string): { title: string; message: string } {
    // Map error codes to templates
    if (errorCode.includes('NETWORK')) {
      return this.templates.error.network;
    } else if (errorCode.includes('TIMEOUT')) {
      return this.templates.error.timeout;
    } else if (errorCode.includes('PERMISSION') || errorCode.includes('AUTH')) {
      return this.templates.error.permission;
    } else if (errorCode.includes('VALIDATION')) {
      return this.templates.error.validation;
    }
    
    // Default error template
    return {
      title: 'Error',
      message: 'An unexpected error occurred. Please try again.'
    };
  }

  /**
   * Get error priority
   */
  private getErrorPriority(errorCode: string): NotificationPriority {
    if (errorCode.includes('CRITICAL') || errorCode.includes('FATAL')) {
      return NotificationPriority.CRITICAL;
    } else if (errorCode.includes('AUTH') || errorCode.includes('PERMISSION')) {
      return NotificationPriority.HIGH;
    } else if (errorCode.includes('NETWORK') || errorCode.includes('TIMEOUT')) {
      return NotificationPriority.MEDIUM;
    }
    return NotificationPriority.LOW;
  }

  /**
   * Play notification sound
   */
  private playNotificationSound(type: NotificationType): void {
    // In real implementation, would play actual sounds
    this.logger.debug('Playing notification sound', { type });
  }

  /**
   * Generate notification ID
   */
  private generateNotificationId(): string {
    return `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get notification statistics
   */
  getStats(): {
    total: number;
    active: number;
    queued: number;
    dismissed: number;
    autoDismissed: number;
    actionClicked: number;
    byType: Record<NotificationType, number>;
    averageDisplayTime: number;
  } {
    const allNotifications = Array.from(this.notifications.values());
    
    const byType = {
      [NotificationType.SUCCESS]: 0,
      [NotificationType.ERROR]: 0,
      [NotificationType.WARNING]: 0,
      [NotificationType.INFO]: 0,
      [NotificationType.PROGRESS]: 0
    };
    
    let totalDisplayTime = 0;
    let displayTimeCount = 0;
    
    for (const status of allNotifications) {
      if (status.shownAt && status.dismissedAt) {
        const displayTime = new Date(status.dismissedAt).getTime() - 
                          new Date(status.shownAt).getTime();
        totalDisplayTime += displayTime;
        displayTimeCount++;
      }
    }
    
    return {
      total: this.notifications.size,
      active: this.activeNotifications.size,
      queued: this.notificationQueue.length,
      dismissed: allNotifications.filter(n => n.dismissed).length,
      autoDismissed: allNotifications.filter(n => n.autoDismissed).length,
      actionClicked: allNotifications.filter(n => n.clickedAction).length,
      byType,
      averageDisplayTime: displayTimeCount > 0 ? totalDisplayTime / displayTimeCount : 0
    };
  }

  /**
   * Clear notification history
   */
  clearHistory(): void {
    // Keep only active notifications
    const activeIds = Array.from(this.activeNotifications);
    
    for (const [id, status] of this.notifications) {
      if (!activeIds.includes(id) && status.dismissed) {
        this.notifications.delete(id);
      }
    }
    
    this.errorContextMap.clear();
  }
}