import React, { useState } from 'react';
import { Save, RotateCcw, Mail, Settings as SettingsIcon, MessageCircle, Cloud, FolderOpen } from 'lucide-react';
import { Settings as SettingsType } from '../App';

interface SettingsProps {
  settings: SettingsType;
  onUpdateSettings: (settings: SettingsType) => Promise<void>;
}

export default function Settings({ settings, onUpdateSettings }: SettingsProps) {
  const [formData, setFormData] = useState({
    ...settings,
    cloud_backup: settings.cloud_backup || {
      enabled: false,
      cloud_directory: '',
      max_backups: 100,
      sync_interval_minutes: 30
    }
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await onUpdateSettings(formData);
      alert('Settings saved successfully!');
    } catch (error) {
      alert('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const resetEmailTemplates = () => {
    if (window.confirm('Are you sure you want to reset email templates to default? This cannot be undone.')) {
      setFormData({
        ...formData,
        email_templates: {
          consent_form: "Dear {ownerName},\n\nThis is a friendly reminder that your dog {dogName} needs their monthly consent form completed for continued daycare services.\n\nPlease complete and return the consent form at your earliest convenience. If you have any questions or concerns, please don't hesitate to contact us.\n\nThank you for choosing our daycare services for {dogName}.\n\nBest regards,\nThe Doggy Daycare Team\n\nDate: {currentDate}",
          vaccine_reminder: "Dear {ownerName},\n\nThis is a friendly reminder that your dog {dogName}'s {vaccineType} vaccination is due to expire on {expirationDate}.\n\nTo ensure {dogName} can continue to enjoy our daycare services, please schedule an appointment with your veterinarian to update their vaccination records.\n\nPlease provide us with the updated vaccination certificate once completed.\n\nThank you for keeping {dogName} healthy and safe.\n\nBest regards,\nThe Doggy Daycare Team"
        },
        email_subjects: {
          consent_form: "Monthly Consent Form Required - {dogName}",
          vaccine_reminder: "Vaccine Record Update Required - {dogName}"
        },
        whatsapp_templates: {
          consent_form: "Hi {ownerName}! 🐕 This is a friendly reminder that {dogName} needs their monthly consent form completed for continued daycare services. Please complete it at your earliest convenience. Thanks!",
          vaccine_reminder: "Hi {ownerName}! 🐕 Just a reminder that {dogName}'s {vaccineType} vaccination expires on {expirationDate}. Please update their vaccination records to continue daycare services. Thanks!"
        }
      });
    }
  };

  return (
    <div className="settings">
      <form onSubmit={handleSubmit}>
        <div className="card">
          <div className="card-header">
            <Mail size={20} />
            <h3>Email Templates</h3>
          </div>
          
          <div className="form-group">
            <label htmlFor="consent-subject">
              Monthly Consent Form Subject
            </label>
            <input
              id="consent-subject"
              type="text"
              className="input"
              value={formData.email_subjects?.consent_form || ''}
              onChange={(e) => setFormData({
                ...formData,
                email_subjects: {
                  ...formData.email_subjects,
                  consent_form: e.target.value
                }
              })}
              placeholder="Monthly Consent Form Required - {dogName}"
            />
            <div className="template-help">
              Available variables: {'{dogName}'}, {'{ownerName}'}, {'{ownerEmail}'}, {'{currentDate}'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="consent-template">
              Monthly Consent Form Template
            </label>
            <textarea
              id="consent-template"
              rows={10}
              className="input"
              value={formData.email_templates.consent_form}
              onChange={(e) => setFormData({
                ...formData,
                email_templates: {
                  ...formData.email_templates,
                  consent_form: e.target.value
                }
              })}
            />
            <div className="template-help">
              Available variables: {'{dogName}'}, {'{ownerName}'}, {'{ownerEmail}'}, {'{currentDate}'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="vaccine-subject">
              Vaccine Reminder Subject
            </label>
            <input
              id="vaccine-subject"
              type="text"
              className="input"
              value={formData.email_subjects?.vaccine_reminder || ''}
              onChange={(e) => setFormData({
                ...formData,
                email_subjects: {
                  ...formData.email_subjects,
                  vaccine_reminder: e.target.value
                }
              })}
              placeholder="Vaccine Record Update Required - {dogName}"
            />
            <div className="template-help">
              Available variables: {'{dogName}'}, {'{ownerName}'}, {'{ownerEmail}'}, {'{vaccineType}'}, {'{expirationDate}'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="vaccine-template">
              Vaccine Reminder Template
            </label>
            <textarea
              id="vaccine-template"
              rows={10}
              className="input"
              value={formData.email_templates.vaccine_reminder}
              onChange={(e) => setFormData({
                ...formData,
                email_templates: {
                  ...formData.email_templates,
                  vaccine_reminder: e.target.value
                }
              })}
            />
            <div className="template-help">
              Available variables: {'{dogName}'}, {'{ownerName}'}, {'{ownerEmail}'}, {'{vaccineType}'}, {'{expirationDate}'}
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary"
              onClick={resetEmailTemplates}
            >
              <RotateCcw size={16} />
              Reset to Default
            </button>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <MessageCircle size={20} />
            <h3>WhatsApp Templates</h3>
          </div>
          
          <div className="form-group">
            <label htmlFor="whatsapp-consent-template">
              Monthly Consent Form WhatsApp Template
            </label>
            <textarea
              id="whatsapp-consent-template"
              rows={6}
              className="input"
              value={formData.whatsapp_templates?.consent_form || ''}
              onChange={(e) => setFormData({
                ...formData,
                whatsapp_templates: {
                  ...formData.whatsapp_templates,
                  consent_form: e.target.value
                }
              })}
            />
            <div className="template-help">
              Available variables: {'{dogName}'}, {'{ownerName}'}, {'{ownerEmail}'}, {'{currentDate}'}
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="whatsapp-vaccine-template">
              Vaccine Reminder WhatsApp Template
            </label>
            <textarea
              id="whatsapp-vaccine-template"
              rows={6}
              className="input"
              value={formData.whatsapp_templates?.vaccine_reminder || ''}
              onChange={(e) => setFormData({
                ...formData,
                whatsapp_templates: {
                  ...formData.whatsapp_templates,
                  vaccine_reminder: e.target.value
                }
              })}
            />
            <div className="template-help">
              Available variables: {'{dogName}'}, {'{ownerName}'}, {'{ownerEmail}'}, {'{vaccineType}'}, {'{expirationDate}'}
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <Cloud size={20} />
            <h3>Cloud Backup Settings</h3>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.cloud_backup?.enabled || false}
                onChange={(e) => setFormData({
                  ...formData,
                  cloud_backup: {
                    ...formData.cloud_backup!,
                    enabled: e.target.checked
                  }
                })}
              />
              <span>Enable automatic cloud backups</span>
            </label>
            <div className="template-help">
              When connected to the internet, automatically backup data to your configured cloud directory
            </div>
          </div>

          {formData.cloud_backup?.enabled && (
            <>
              <div className="form-group">
                <label htmlFor="cloud-directory">
                  <FolderOpen size={16} style={{ display: 'inline', marginRight: '8px' }} />
                  Cloud Directory Path
                </label>
                <input
                  id="cloud-directory"
                  type="text"
                  className="input"
                  value={formData.cloud_backup.cloud_directory}
                  onChange={(e) => setFormData({
                    ...formData,
                    cloud_backup: {
                      ...formData.cloud_backup!,
                      cloud_directory: e.target.value
                    }
                  })}
                  placeholder="/path/to/your/cloud/folder (e.g., /Users/you/Dropbox/DoggyDaycare)"
                />
                <div className="template-help">
                  Path to your cloud synced folder (Dropbox, Google Drive, OneDrive, etc.)
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="max-backups">
                  Maximum Backup Files
                </label>
                <input
                  id="max-backups"
                  type="number"
                  min="10"
                  max="200"
                  className="input"
                  value={formData.cloud_backup.max_backups}
                  onChange={(e) => setFormData({
                    ...formData,
                    cloud_backup: {
                      ...formData.cloud_backup!,
                      max_backups: parseInt(e.target.value) || 100
                    }
                  })}
                />
                <div className="template-help">
                  Number of backup files to keep before overwriting oldest (10-200)
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="sync-interval">
                  Auto-Sync Interval (minutes)
                </label>
                <input
                  id="sync-interval"
                  type="number"
                  min="5"
                  max="480"
                  className="input"
                  value={formData.cloud_backup.sync_interval_minutes}
                  onChange={(e) => setFormData({
                    ...formData,
                    cloud_backup: {
                      ...formData.cloud_backup!,
                      sync_interval_minutes: parseInt(e.target.value) || 30
                    }
                  })}
                />
                <div className="template-help">
                  How often to automatically sync when online (5-480 minutes)
                </div>
              </div>
            </>
          )}
        </div>

        <div className="card">
          <div className="card-header">
            <SettingsIcon size={20} />
            <h3>General Settings</h3>
          </div>

          <div className="form-group">
            <label htmlFor="business-name">
              Business Name
            </label>
            <input
              id="business-name"
              type="text"
              className="input"
              value={formData.business_name}
              onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
              placeholder="Your Doggy Daycare Name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="business-phone">
              Business Phone Number
            </label>
            <input
              id="business-phone"
              type="tel"
              className="input"
              value={formData.business_phone || ''}
              onChange={(e) => setFormData({ ...formData, business_phone: e.target.value })}
              placeholder="+1234567890"
            />
            <div className="template-help">
              Include country code (e.g., +1 for US/Canada)
            </div>
          </div>

          <div className="form-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={formData.auto_backup}
                onChange={(e) => setFormData({ ...formData, auto_backup: e.target.checked })}
              />
              <span>Enable automatic daily backups</span>
            </label>
          </div>
        </div>

        <div className="form-actions">
          <button 
            type="submit" 
            className="btn btn-primary"
            disabled={isSaving}
          >
            <Save size={16} />
            {isSaving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </form>
    </div>
  );
}