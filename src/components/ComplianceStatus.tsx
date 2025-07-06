import { invoke } from '@tauri-apps/api/core';
import { Mail, FileText, Syringe, AlertTriangle, CheckCircle } from 'lucide-react';
import { Dog, Settings } from '../App';

interface ComplianceStatusProps {
  dogs: Dog[];
  settings: Settings | null;
}

export default function ComplianceStatus({ dogs, settings }: ComplianceStatusProps) {
  const getVaccineStatus = (dog: Dog) => {
    if (!dog.vaccine_date) return 'missing';
    
    const vaccineDate = new Date(dog.vaccine_date);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    
    return vaccineDate < oneYearAgo ? 'expired' : 'current';
  };

  const getConsentStatus = (dog: Dog) => {
    if (!dog.consent_last_signed) return 'missing';
    
    const consentDate = new Date(dog.consent_last_signed);
    const oneMonthAgo = new Date();
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    
    return consentDate < oneMonthAgo ? 'expired' : 'current';
  };

  const sendConsentEmail = async (dog: Dog) => {
    if (!dog.email || !settings) {
      alert('No email address available for this dog owner.');
      return;
    }

    try {
      const template = settings.email_templates.consent_form
        .replace(/{dogName}/g, dog.name)
        .replace(/{ownerName}/g, dog.owner)
        .replace(/{ownerEmail}/g, dog.email)
        .replace(/{currentDate}/g, new Date().toLocaleDateString());

      const subject = settings.email_subjects?.consent_form
        ?.replace(/{dogName}/g, dog.name)
        ?.replace(/{ownerName}/g, dog.owner)
        ?.replace(/{ownerEmail}/g, dog.email)
        ?.replace(/{currentDate}/g, new Date().toLocaleDateString())
        || `Monthly Consent Form Required - ${dog.name}`;

      await invoke('open_email', {
        to: dog.email,
        subject: subject,
        body: template
      });
    } catch (error) {
      console.error('Failed to open email:', error);
      alert('Failed to open email client.');
    }
  };

  const sendVaccineEmail = async (dog: Dog) => {
    if (!dog.email || !settings) {
      alert('No email address available for this dog owner.');
      return;
    }

    try {
      const expirationDate = dog.vaccine_date 
        ? new Date(new Date(dog.vaccine_date).getFullYear() + 1, new Date(dog.vaccine_date).getMonth(), new Date(dog.vaccine_date).getDate())
        : null;

      const template = settings.email_templates.vaccine_reminder
        .replace(/{dogName}/g, dog.name)
        .replace(/{ownerName}/g, dog.owner)
        .replace(/{ownerEmail}/g, dog.email)
        .replace(/{vaccineType}/g, 'annual vaccination')
        .replace(/{expirationDate}/g, expirationDate ? expirationDate.toLocaleDateString() : 'Not available');

      const subject = settings.email_subjects?.vaccine_reminder
        ?.replace(/{dogName}/g, dog.name)
        ?.replace(/{ownerName}/g, dog.owner)
        ?.replace(/{ownerEmail}/g, dog.email)
        ?.replace(/{vaccineType}/g, 'annual vaccination')
        ?.replace(/{expirationDate}/g, expirationDate ? expirationDate.toLocaleDateString() : 'Not available')
        || `Vaccine Record Update Required - ${dog.name}`;

      await invoke('open_email', {
        to: dog.email,
        subject: subject,
        body: template
      });
    } catch (error) {
      console.error('Failed to open email:', error);
      alert('Failed to open email client.');
    }
  };

  const vaccineIssues = dogs.filter(dog => getVaccineStatus(dog) !== 'current');
  const consentIssues = dogs.filter(dog => getConsentStatus(dog) !== 'current');

  return (
    <div className="compliance-status">
      <div className="compliance-stats">
        <div className="stat-card consent">
          <div className="stat-header">
            <FileText size={24} />
            <h4>Monthly Consent Forms</h4>
          </div>
          <div className="stat-content">
            <div className="stat-number">
              {dogs.length - consentIssues.length}/{dogs.length}
            </div>
            <div className="stat-label">Current</div>
          </div>
        </div>
        
        <div className="stat-card vaccine">
          <div className="stat-header">
            <Syringe size={24} />
            <h4>Vaccine Records</h4>
          </div>
          <div className="stat-content">
            <div className="stat-number">
              {dogs.length - vaccineIssues.length}/{dogs.length}
            </div>
            <div className="stat-label">Current</div>
          </div>
        </div>
      </div>

      {consentIssues.length > 0 && (
        <div className="compliance-section">
          <h3 className="section-title">
            <AlertTriangle size={20} />
            Consent Form Issues ({consentIssues.length})
          </h3>
          <div className="compliance-grid">
            {consentIssues.map(dog => (
              <div key={dog.id} className="compliance-card consent-issue">
                <div className="compliance-header">
                  <h4>{dog.name}</h4>
                  <span className={`status-badge ${getConsentStatus(dog)}`}>
                    {getConsentStatus(dog) === 'missing' ? 'Missing' : 'Expired'}
                  </span>
                </div>
                <div className="compliance-info">
                  <p><strong>Owner:</strong> {dog.owner}</p>
                  {dog.consent_last_signed && (
                    <p><strong>Last Signed:</strong> {new Date(dog.consent_last_signed).toLocaleDateString()}</p>
                  )}
                  {dog.email && <p><strong>Email:</strong> {dog.email}</p>}
                </div>
                <div className="compliance-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => sendConsentEmail(dog)}
                    disabled={!dog.email}
                  >
                    <Mail size={16} />
                    Send Reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {vaccineIssues.length > 0 && (
        <div className="compliance-section">
          <h3 className="section-title">
            <AlertTriangle size={20} />
            Vaccine Record Issues ({vaccineIssues.length})
          </h3>
          <div className="compliance-grid">
            {vaccineIssues.map(dog => (
              <div key={dog.id} className="compliance-card vaccine-issue">
                <div className="compliance-header">
                  <h4>{dog.name}</h4>
                  <span className={`status-badge ${getVaccineStatus(dog)}`}>
                    {getVaccineStatus(dog) === 'missing' ? 'Missing' : 'Expired'}
                  </span>
                </div>
                <div className="compliance-info">
                  <p><strong>Owner:</strong> {dog.owner}</p>
                  {dog.vaccine_date && (
                    <p><strong>Last Vaccine:</strong> {new Date(dog.vaccine_date).toLocaleDateString()}</p>
                  )}
                  {dog.email && <p><strong>Email:</strong> {dog.email}</p>}
                </div>
                <div className="compliance-actions">
                  <button 
                    className="btn btn-primary"
                    onClick={() => sendVaccineEmail(dog)}
                    disabled={!dog.email}
                  >
                    <Mail size={16} />
                    Send Reminder
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {consentIssues.length === 0 && vaccineIssues.length === 0 && (
        <div className="compliance-section">
          <div className="compliance-success">
            <CheckCircle size={48} className="success-icon" />
            <h3>All Compliance Requirements Met!</h3>
            <p>All dogs have current consent forms and vaccine records.</p>
          </div>
        </div>
      )}
    </div>
  );
}