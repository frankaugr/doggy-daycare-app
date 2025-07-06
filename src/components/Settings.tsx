import React, { useState } from 'react';
import { Save, RotateCcw, Mail, Settings as SettingsIcon } from 'lucide-react';
import { Settings as SettingsType } from '../App';

interface SettingsProps {
  settings: SettingsType;
  onUpdateSettings: (settings: SettingsType) => Promise<void>;
}

export default function Settings({ settings, onUpdateSettings }: SettingsProps) {
  const [formData, setFormData] = useState(settings);
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