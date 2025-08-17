import { invoke } from '@tauri-apps/api/core';
import type { Dog, Settings, ComplianceAlert } from '../types';
import { ComplianceService } from './complianceService';

export class NotificationService {
  /**
   * Replace template variables in a string with actual values
   */
  private static replaceTemplateVariables(
    template: string, 
    variables: Record<string, string>
  ): string {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = `{${key}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
    
    return result;
  }

  /**
   * Generate email content for a compliance alert
   */
  static generateEmailContent(
    alert: ComplianceAlert,
    dog: Dog,
    settings: Settings
  ): { subject: string; body: string } {
    const variables = ComplianceService.getTemplateVariables(alert, dog);
    
    let template: string;
    let subjectTemplate: string;

    if (alert.type.includes('vaccine')) {
      template = settings.email_templates.vaccine_reminder;
      subjectTemplate = settings.email_subjects.vaccine_reminder;
    } else if (alert.type.includes('consent')) {
      template = settings.email_templates.consent_form;
      subjectTemplate = settings.email_subjects.consent_form;
    } else {
      // Fallback template
      template = `Dear {ownerName},\n\nThis is a reminder regarding {dogName}.\n\n${alert.message}\n\nPlease contact us if you have any questions.\n\nBest regards,\n${settings.business_name}`;
      subjectTemplate = 'Important Notice - {dogName}';
    }

    const subject = this.replaceTemplateVariables(subjectTemplate, variables);
    const body = this.replaceTemplateVariables(template, variables);

    return { subject, body };
  }

  /**
   * Generate WhatsApp message content for a compliance alert
   */
  static generateWhatsAppContent(
    alert: ComplianceAlert,
    dog: Dog,
    settings: Settings
  ): string {
    const variables = ComplianceService.getTemplateVariables(alert, dog);
    
    let template: string;

    if (alert.type.includes('vaccine')) {
      template = settings.whatsapp_templates.vaccine_reminder;
    } else if (alert.type.includes('consent')) {
      template = settings.whatsapp_templates.consent_form;
    } else {
      // Fallback template
      template = `Hi {ownerName}! This is a reminder regarding {dogName}. ${alert.message} Please contact us if you have any questions. Thanks!`;
    }

    return this.replaceTemplateVariables(template, variables);
  }

  /**
   * Send email notification
   */
  static async sendEmail(
    alert: ComplianceAlert,
    dog: Dog,
    settings: Settings
  ): Promise<void> {
    const { subject, body } = this.generateEmailContent(alert, dog, settings);
    
    try {
      await invoke('open_email', {
        to: dog.email,
        subject,
        body
      });
    } catch (error) {
      console.error('Failed to open email client:', error);
      throw new Error(`Failed to send email: ${error}`);
    }
  }

  /**
   * Send WhatsApp message (opens WhatsApp with pre-filled message)
   */
  static async sendWhatsApp(
    alert: ComplianceAlert,
    dog: Dog,
    settings: Settings
  ): Promise<void> {
    const message = this.generateWhatsAppContent(alert, dog, settings);
    
    // Format phone number for WhatsApp (remove non-digits and ensure country code)
    let phoneNumber = dog.phone.replace(/\D/g, '');
    
    // If no country code, assume US (+1) - this should be configurable
    if (phoneNumber.length === 10) {
      phoneNumber = '1' + phoneNumber;
    }
    
    const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodeURIComponent(message)}`;
    
    try {
      await invoke('open_url', { url: whatsappUrl });
    } catch (error) {
      console.error('Failed to open WhatsApp:', error);
      throw new Error(`Failed to open WhatsApp: ${error}`);
    }
  }

  /**
   * Send multiple notifications for a list of alerts
   */
  static async sendBulkNotifications(
    alerts: ComplianceAlert[],
    dogs: Dog[],
    settings: Settings,
    method: 'email' | 'whatsapp'
  ): Promise<{ successful: number; failed: number; errors: string[] }> {
    const dogMap = new Map(dogs.map(dog => [dog.id, dog]));
    let successful = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const alert of alerts) {
      const dog = dogMap.get(alert.dog_id);
      if (!dog) {
        failed++;
        errors.push(`Dog not found for alert ${alert.id}`);
        continue;
      }

      try {
        if (method === 'email') {
          await this.sendEmail(alert, dog, settings);
        } else {
          await this.sendWhatsApp(alert, dog, settings);
        }
        successful++;
      } catch (error) {
        failed++;
        errors.push(`Failed to send ${method} to ${dog.owner} (${dog.name}): ${error}`);
      }
    }

    return { successful, failed, errors };
  }

  /**
   * Schedule automatic reminders (this would integrate with a scheduling system)
   */
  static scheduleReminders(
    alerts: ComplianceAlert[],
    dogs: Dog[],
    settings: Settings
  ): void {
    // This is a placeholder for automatic reminder scheduling
    // In a real implementation, this would integrate with a background task scheduler
    
    console.log(`Scheduling ${alerts.length} reminders`);
    
    // Group alerts by urgency
    const urgentAlerts = alerts.filter(alert => 
      alert.severity === 'critical' || 
      (alert.severity === 'high' && (alert.days_overdue || 0) > 0)
    );
    
    const upcomingAlerts = alerts.filter(alert => 
      alert.severity === 'medium' || 
      (alert.severity === 'high' && !(alert.days_overdue || 0) > 0)
    );

    // Immediate reminders for urgent items
    if (urgentAlerts.length > 0) {
      console.log(`${urgentAlerts.length} urgent reminders to be sent immediately`);
    }

    // Schedule future reminders for upcoming items
    if (upcomingAlerts.length > 0) {
      console.log(`${upcomingAlerts.length} reminders scheduled for future dates`);
    }
  }

  /**
   * Generate reminder summary for display
   */
  static generateReminderSummary(
    alerts: ComplianceAlert[],
    dogs: Dog[]
  ): {
    totalReminders: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
    upcomingDeadlines: Array<{ date: string; count: number }>;
  } {
    const dogMap = new Map(dogs.map(dog => [dog.id, dog]));
    
    const byType: Record<string, number> = {};
    const bySeverity: Record<string, number> = {};
    const deadlineMap: Map<string, number> = new Map();

    for (const alert of alerts) {
      // Count by type
      byType[alert.type] = (byType[alert.type] || 0) + 1;
      
      // Count by severity
      bySeverity[alert.severity] = (bySeverity[alert.severity] || 0) + 1;
      
      // Count by due date
      if (alert.due_date) {
        const count = deadlineMap.get(alert.due_date) || 0;
        deadlineMap.set(alert.due_date, count + 1);
      }
    }

    const upcomingDeadlines = Array.from(deadlineMap.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10); // Top 10 upcoming deadlines

    return {
      totalReminders: alerts.length,
      byType,
      bySeverity,
      upcomingDeadlines
    };
  }

  /**
   * Check if notifications are enabled for a given method
   */
  static isNotificationEnabled(
    settings: Settings,
    method: 'email' | 'whatsapp' | 'desktop'
  ): boolean {
    if (!settings.notification_settings) {
      return true; // Default to enabled if no settings
    }

    switch (method) {
      case 'email':
        return settings.notification_settings.email_enabled;
      case 'whatsapp':
        return settings.notification_settings.whatsapp_enabled;
      case 'desktop':
        return settings.notification_settings.desktop_notifications;
      default:
        return false;
    }
  }

  /**
   * Send desktop notification (for in-app alerts)
   */
  static async sendDesktopNotification(
    title: string,
    message: string,
    options?: NotificationOptions
  ): Promise<void> {
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        new Notification(title, {
          body: message,
          icon: '/app-icon.png',
          ...options
        });
      } else if (Notification.permission !== 'denied') {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          new Notification(title, {
            body: message,
            icon: '/app-icon.png',
            ...options
          });
        }
      }
    }
  }
}