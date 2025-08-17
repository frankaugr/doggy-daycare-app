import { differenceInDays, parseISO, addMonths } from 'date-fns';
import type { Dog, ComplianceAlert } from '../types';

export class ComplianceService {
  private static readonly VACCINE_WARNING_DAYS = 30; // Warn 30 days before expiration
  private static readonly CONSENT_INTERVAL_MONTHS = 1; // Monthly consent renewal
  private static readonly CONSENT_WARNING_DAYS = 7; // Warn 7 days before consent expires

  /**
   * Check all compliance issues for a single dog
   */
  static checkDogCompliance(dog: Dog): ComplianceAlert[] {
    const alerts: ComplianceAlert[] = [];
    const today = new Date();

    // Check vaccination compliance
    if (dog.vaccine_date) {
      const vaccineDate = parseISO(dog.vaccine_date);
      const vaccineExpiryDate = addMonths(vaccineDate, 12); // Vaccines typically last 1 year
      const daysUntilExpiry = differenceInDays(vaccineExpiryDate, today);

      if (daysUntilExpiry < 0) {
        alerts.push({
          id: `${dog.id}-vaccine-expired`,
          dog_id: dog.id,
          dog_name: dog.name,
          type: 'vaccine_expired',
          message: `${dog.name}'s vaccination expired ${Math.abs(daysUntilExpiry)} days ago`,
          severity: 'critical',
          due_date: vaccineExpiryDate.toISOString().split('T')[0],
          days_overdue: Math.abs(daysUntilExpiry)
        });
      } else if (daysUntilExpiry <= this.VACCINE_WARNING_DAYS) {
        alerts.push({
          id: `${dog.id}-vaccine-expiring`,
          dog_id: dog.id,
          dog_name: dog.name,
          type: 'vaccine_expiring',
          message: `${dog.name}'s vaccination expires in ${daysUntilExpiry} days`,
          severity: daysUntilExpiry <= 7 ? 'high' : 'medium',
          due_date: vaccineExpiryDate.toISOString().split('T')[0]
        });
      }
    } else {
      // No vaccination record
      alerts.push({
        id: `${dog.id}-vaccine-missing`,
        dog_id: dog.id,
        dog_name: dog.name,
        type: 'vaccine_expired',
        message: `${dog.name} has no vaccination record on file`,
        severity: 'critical'
      });
    }

    // Check consent form compliance
    if (dog.consent_last_signed) {
      const consentDate = parseISO(dog.consent_last_signed);
      const consentExpiryDate = addMonths(consentDate, this.CONSENT_INTERVAL_MONTHS);
      const daysUntilExpiry = differenceInDays(consentExpiryDate, today);

      if (daysUntilExpiry < 0) {
        alerts.push({
          id: `${dog.id}-consent-expired`,
          dog_id: dog.id,
          dog_name: dog.name,
          type: 'consent_expired',
          message: `${dog.name}'s consent form expired ${Math.abs(daysUntilExpiry)} days ago`,
          severity: 'high',
          due_date: consentExpiryDate.toISOString().split('T')[0],
          days_overdue: Math.abs(daysUntilExpiry)
        });
      } else if (daysUntilExpiry <= this.CONSENT_WARNING_DAYS) {
        alerts.push({
          id: `${dog.id}-consent-expiring`,
          dog_id: dog.id,
          dog_name: dog.name,
          type: 'consent_expiring',
          message: `${dog.name}'s consent form expires in ${daysUntilExpiry} days`,
          severity: daysUntilExpiry <= 3 ? 'high' : 'medium',
          due_date: consentExpiryDate.toISOString().split('T')[0]
        });
      }
    } else {
      // No consent form signed
      alerts.push({
        id: `${dog.id}-consent-missing`,
        dog_id: dog.id,
        dog_name: dog.name,
        type: 'consent_expired',
        message: `${dog.name} has no consent form on file`,
        severity: 'high'
      });
    }

    return alerts;
  }

  /**
   * Check compliance for all dogs
   */
  static checkAllCompliance(dogs: Dog[]): ComplianceAlert[] {
    const activeDogs = dogs.filter(dog => dog.is_active);
    const allAlerts: ComplianceAlert[] = [];

    for (const dog of activeDogs) {
      const dogAlerts = this.checkDogCompliance(dog);
      allAlerts.push(...dogAlerts);
    }

    // Sort by severity and due date
    return allAlerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      const severityDiff = severityOrder[a.severity] - severityOrder[b.severity];
      
      if (severityDiff !== 0) return severityDiff;
      
      // If same severity, sort by days overdue (descending) or due date (ascending)
      if (a.days_overdue && b.days_overdue) {
        return b.days_overdue - a.days_overdue;
      }
      
      if (a.due_date && b.due_date) {
        return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
      }
      
      return 0;
    });
  }

  /**
   * Get compliance statistics
   */
  static getComplianceStats(dogs: Dog[]) {
    const activeDogs = dogs.filter(dog => dog.is_active);
    const alerts = this.checkAllCompliance(dogs);
    
    const vaccineIssues = alerts.filter(alert => 
      alert.type === 'vaccine_expired' || alert.type === 'vaccine_expiring'
    );
    
    const consentIssues = alerts.filter(alert => 
      alert.type === 'consent_expired' || alert.type === 'consent_expiring'
    );

    const criticalIssues = alerts.filter(alert => alert.severity === 'critical');
    const highIssues = alerts.filter(alert => alert.severity === 'high');

    return {
      totalDogs: activeDogs.length,
      totalIssues: alerts.length,
      vaccineIssues: vaccineIssues.length,
      consentIssues: consentIssues.length,
      criticalIssues: criticalIssues.length,
      highIssues: highIssues.length,
      complianceRate: activeDogs.length > 0 ? 
        Math.round(((activeDogs.length - alerts.length) / activeDogs.length) * 100) : 
        100
    };
  }

  /**
   * Generate email/WhatsApp template variables for an alert
   */
  static getTemplateVariables(alert: ComplianceAlert, dog: Dog) {
    const today = new Date();
    
    const baseVariables = {
      dogName: dog.name,
      ownerName: dog.owner,
      ownerEmail: dog.email,
      currentDate: today.toLocaleDateString()
    };

    if (alert.type.includes('vaccine')) {
      return {
        ...baseVariables,
        vaccineType: 'annual vaccination',
        expirationDate: alert.due_date ? 
          new Date(alert.due_date).toLocaleDateString() : 
          'unknown'
      };
    }

    return baseVariables;
  }

  /**
   * Check if a dog needs attention based on compliance alerts
   */
  static needsAttention(dog: Dog): boolean {
    const alerts = this.checkDogCompliance(dog);
    return alerts.some(alert => 
      alert.severity === 'critical' || alert.severity === 'high'
    );
  }

  /**
   * Get next action required for a dog
   */
  static getNextAction(dog: Dog): string | null {
    const alerts = this.checkDogCompliance(dog);
    
    if (alerts.length === 0) {
      return null;
    }

    // Return the most urgent action
    const urgentAlert = alerts[0]; // Already sorted by urgency
    
    switch (urgentAlert.type) {
      case 'vaccine_expired':
        return 'Update vaccination records';
      case 'vaccine_expiring':
        return 'Schedule vaccination appointment';
      case 'consent_expired':
        return 'Obtain new consent form';
      case 'consent_expiring':
        return 'Remind owner about consent renewal';
      default:
        return 'Review compliance status';
    }
  }

  /**
   * Calculate compliance trend over time
   */
  static calculateComplianceTrend(dogs: Dog[], days: number = 30): number {
    // This would typically compare current compliance to historical data
    // For now, we'll provide a simplified calculation based on how many
    // dogs have up-to-date records vs. those that will expire soon
    
    const activeDogs = dogs.filter(dog => dog.is_active);
    const alerts = this.checkAllCompliance(dogs);
    
    const upcomingIssues = alerts.filter(alert => 
      alert.type.includes('expiring') && 
      alert.due_date &&
      differenceInDays(parseISO(alert.due_date), new Date()) <= days
    );

    const currentCompliance = (activeDogs.length - alerts.length) / activeDogs.length;
    const projectedCompliance = (activeDogs.length - alerts.length - upcomingIssues.length) / activeDogs.length;
    
    return ((projectedCompliance - currentCompliance) * 100);
  }
}