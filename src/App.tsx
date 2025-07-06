import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Heart } from 'lucide-react';

import DailyChecklist from './components/DailyChecklist';
import DogManagement from './components/DogManagement';
import ComplianceStatus from './components/ComplianceStatus';
import Settings from './components/Settings';
import './App.css';

export interface Dog {
  id: string;
  name: string;
  owner: string;
  phone: string;
  email: string;
  breed: string;
  age: string;
  vaccine_date?: string;
  consent_last_signed?: string;
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
    dogs: Record<string, boolean>;
  };
  records: Record<string, DailyRecord>;
  am_temp?: string;
  pm_temp?: string;
}

export interface Settings {
  business_name: string;
  auto_backup: boolean;
  email_templates: {
    consent_form: string;
    vaccine_reminder: string;
  };
}

type Tab = 'daily' | 'management' | 'compliance' | 'settings';

function App() {
  const [currentTab, setCurrentTab] = useState<Tab>('daily');
  const [dogs, setDogs] = useState<Dog[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  useEffect(() => {
    loadDogs();
    loadSettings();
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
      await invoke('add_dog', {
        name: dogData.name,
        owner: dogData.owner,
        phone: dogData.phone,
        email: dogData.email,
        breed: dogData.breed,
        age: dogData.age,
        vaccineDate: dogData.vaccine_date || null,
      });
      loadDogs();
    } catch (error) {
      console.error('Failed to add dog:', error);
      throw error;
    }
  };

  const updateDog = async (dog: Dog) => {
    try {
      await invoke('update_dog', { dog });
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
          <Heart className="header-icon" size={32} />
          <h1>{settings?.business_name || 'Doggy Daycare Manager'}</h1>
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
