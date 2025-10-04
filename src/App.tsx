import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Heart } from 'lucide-react';

import DailyChecklist from './components/DailyChecklist';
import DogManagement from './components/DogManagement';
import ComplianceStatus from './components/ComplianceStatus';
import Settings from './components/Settings';
import ConnectionStatus from './components/ConnectionStatus';
import Calendar from './components/Calendar';
import { cloudBackupService } from './services/cloudBackup';
import './App.css';

export interface DogSchedule {
  daycare_days: number[];
  training_days: number[];
  boarding_days: number[];
  daycare_drop_off?: string;
  daycare_pick_up?: string;
  training_drop_off?: string;
  training_pick_up?: string;
  start_date?: string;
  end_date?: string;
  active: boolean;
}

export interface Dog {
  id: string;
  name: string;
  owner: string;
  phone: string;
  email: string;
  breed: string;
  date_of_birth?: string;
  vaccine_date?: string;
  consent_last_signed?: string;
  created_at: string;
  schedule: DogSchedule;
  household_id?: string;
}

export enum ServiceType {
  Daycare = 'Daycare',
  Training = 'Training',
  Boarding = 'Boarding',
}

export enum AttendanceType {
  NotAttending = 'not_attending',
  HalfDay = 'half_day',
  FullDay = 'full_day',
}

export enum RecurrencePattern {
  None = 'None',
  Daily = 'Daily',
  Weekly = 'Weekly',
  BiWeekly = 'BiWeekly',
  Monthly = 'Monthly',
  Custom = 'Custom',
}

export interface AttendanceEntry {
  dog_id: string;
  service_type: ServiceType;
  attending: boolean;
  drop_off_time?: string;
  pick_up_time?: string;
  notes?: string;
}

export interface RecurringSchedule {
  id: string;
  dog_id: string;
  service_type: ServiceType;
  pattern: RecurrencePattern;
  start_date: string;
  end_date?: string;
  drop_off_time?: string;
  pick_up_time?: string;
  active: boolean;
  created_at: string;
}

export interface DailyRecord {
  checklist?: Record<string, boolean>;
  feeding_times?: string;
  drop_off_time?: string;
  pick_up_time?: string;
  notes?: string;
}

export interface DayData {
  attendance: {
    dogs: Record<string, boolean>; // Legacy format - keep for backward compatibility
    types?: Record<string, AttendanceType>; // New format with Half-Day support
  };
  records: Record<string, DailyRecord>;
  am_temp?: string;
  pm_temp?: string;
}

export interface BackupFileInfo {
  filename: string;
  filepath: string;
  modified_time: string;
  size_bytes: number;
}

export interface Settings {
  business_name: string;
  business_phone: string;
  auto_backup: boolean;
  cloud_backup?: {
    enabled: boolean;
    cloud_directory: string;
    max_backups: number;
    sync_interval_minutes: number;
  };
  email_templates: {
    consent_form: string;
    vaccine_reminder: string;
  };
  email_subjects: {
    consent_form: string;
    vaccine_reminder: string;
  };
  whatsapp_templates: {
    consent_form: string;
    vaccine_reminder: string;
  };
}

type Tab = 'daily' | 'management' | 'calendar' | 'compliance' | 'settings';

function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('daily');
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadDogs();
    loadSettings();
    
    
    return () => {
      cloudBackupService.stopConnectivityMonitoring();
    };
  }, []);

  const loadDogs = async () => {
    try {
      const result = await invoke<Dog[]>('get_all_dogs');
      setDogs(result);
    } catch (error) {
      console.error('Failed to load dogs:', error);
    }
  };

  const loadSettings = async () => {
    try {
      const result = await invoke<Settings>('get_settings');
      setSettings(result);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  };

  const addDog = async (dogData: Omit<Dog, 'id' | 'created_at'>) => {
    try {
      const invokeParams = {
        name: dogData.name,
        owner: dogData.owner,
        phone: dogData.phone,
        email: dogData.email,
        breed: dogData.breed,
        dateOfBirth: dogData.date_of_birth || null,
        vaccineDate: dogData.vaccine_date || null,
        schedule: dogData.schedule || null,
        householdId: dogData.household_id || '',
      };

      if (import.meta.env.DEV) {
        // Helpful during development to inspect payload cross-platform
        console.log('App.addDog invoke params:', invokeParams);
      }
      await invoke('add_dog', invokeParams);
      loadDogs();
    } catch (error) {
      console.error('Failed to add dog:', error);
      throw error;
    }
  };

  const updateDog = async (dog: Dog) => {
    try {
      // Clean up schedule data - convert empty strings to null for optional fields
      const cleanDog = {
        ...dog,
        schedule: {
          ...dog.schedule,
          daycare_drop_off: dog.schedule.daycare_drop_off || null,
          daycare_pick_up: dog.schedule.daycare_pick_up || null,
          training_drop_off: dog.schedule.training_drop_off || null,
          training_pick_up: dog.schedule.training_pick_up || null,
          start_date: dog.schedule.start_date || null,
          end_date: dog.schedule.end_date || null,
        }
      };

      await invoke('update_dog', { dog: cleanDog });
      loadDogs();
    } catch (error) {
      console.error('Failed to update dog:', error);
      throw error;
    }
  };

  const deleteDog = async (dogId: string) => {
    try {
      await invoke('delete_dog', { dogId });
      loadDogs();
    } catch (error) {
      console.error('Failed to delete dog:', error);
      throw error;
    }
  };

  const updateSettings = async (newSettings: Settings) => {
    try {
      await invoke('update_settings', { settings: newSettings });
      setSettings(newSettings);
      
      if (newSettings.cloud_backup) {
        await cloudBackupService.updateCloudBackupConfig(newSettings.cloud_backup);
      }
    } catch (error) {
      console.error('Failed to update settings:', error);
      throw error;
    }
  };

  const exportData = async () => {
    try {
      const data = await invoke<string>('export_data');
      const blob = new Blob([data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `doggy-daycare-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export data:', error);
    }
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      await invoke('import_data', { jsonData: text });
      loadDogs();
      loadSettings();
    } catch (error) {
      console.error('Failed to import data:', error);
      throw error;
    }
  };

  const renderTab = () => {
    switch (currentTab) {
      case 'daily':
        return <DailyChecklist dogs={dogs} />;
      case 'management':
        return (
          <DogManagement 
            dogs={dogs}
            onAddDog={addDog}
            onUpdateDog={updateDog}
            onDeleteDog={deleteDog}
            onExportData={exportData}
            onImportData={importData}
          />
        );
      case 'calendar':
        return <Calendar dogs={dogs} />;
      case 'compliance':
        return <ComplianceStatus dogs={dogs} settings={settings} />;
      case 'settings':
        return settings ? (
          <Settings 
            settings={settings}
            onUpdateSettings={updateSettings}
          />
        ) : (
          <div>Loading settings...</div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-left">
            <Heart className="header-icon" size={32} />
            <h1>{settings?.business_name || 'Doggy Daycare Manager'}</h1>
          </div>
          <div className="header-right">
            <ConnectionStatus />
          </div>
        </header>

        <nav className="tabs">
          <button 
            className={`tab ${currentTab === 'daily' ? 'active' : ''}`}
            onClick={() => setCurrentTab('daily')}
          >
            Daily Checklist
          </button>
          <button 
            className={`tab ${currentTab === 'management' ? 'active' : ''}`}
            onClick={() => setCurrentTab('management')}
          >
            Dog Management
          </button>
          <button 
            className={`tab ${currentTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setCurrentTab('calendar')}
          >
            Calendar
          </button>
          <button 
            className={`tab ${currentTab === 'compliance' ? 'active' : ''}`}
            onClick={() => setCurrentTab('compliance')}
          >
            Compliance Status
          </button>
          <button 
            className={`tab ${currentTab === 'settings' ? 'active' : ''}`}
            onClick={() => setCurrentTab('settings')}
          >
            Settings
          </button>
        </nav>

        <main className="tab-content">
          {renderTab()}
        </main>
      </div>
    </div>
  );
}

export default App;
