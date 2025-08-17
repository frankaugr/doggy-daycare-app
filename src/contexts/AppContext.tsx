import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { 
  AppState, 
  AppAction, 
  Dog, 
  Settings, 
  DayData
} from '../types';

// Initial state
const initialState: AppState = {
  dogs: [],
  dayData: {},
  settings: null,
  connectionStatus: {
    online: false,
    lastCheck: new Date(),
    syncStatus: 'idle'
  },
  loading: false,
  error: null,
  syncQueue: []
};

// App reducer
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    
    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false };
    
    case 'SET_DOGS':
      return { ...state, dogs: action.payload };
    
    case 'ADD_DOG':
      return { ...state, dogs: [...state.dogs, action.payload] };
    
    case 'UPDATE_DOG':
      return {
        ...state,
        dogs: state.dogs.map(dog => 
          dog.id === action.payload.id ? action.payload : dog
        )
      };
    
    case 'DELETE_DOG':
      return {
        ...state,
        dogs: state.dogs.filter(dog => dog.id !== action.payload)
      };
    
    case 'SET_DAY_DATA':
      return {
        ...state,
        dayData: {
          ...state.dayData,
          [action.payload.date]: action.payload.data
        }
      };
    
    case 'SET_SETTINGS':
      return { ...state, settings: action.payload };
    
    case 'SET_CONNECTION_STATUS':
      return { ...state, connectionStatus: action.payload };
    
    case 'ADD_SYNC_OPERATION':
      return {
        ...state,
        syncQueue: [...state.syncQueue, action.payload]
      };
    
    case 'REMOVE_SYNC_OPERATION':
      return {
        ...state,
        syncQueue: state.syncQueue.filter(op => op.id !== action.payload)
      };
    
    case 'CLEAR_SYNC_QUEUE':
      return { ...state, syncQueue: [] };
    
    default:
      return state;
  }
}

// Context
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
  // Action creators
  loadDogs: () => Promise<void>;
  addDog: (dogData: Omit<Dog, 'id' | 'created_at' | 'is_active'>) => Promise<void>;
  updateDog: (dog: Dog) => Promise<void>;
  deleteDog: (id: string) => Promise<void>;
  loadSettings: () => Promise<void>;
  updateSettings: (settings: Settings) => Promise<void>;
  loadDayData: (date: string) => Promise<void>;
  saveDayData: (date: string, data: DayData) => Promise<void>;
  exportData: () => Promise<void>;
  importData: (file: File) => Promise<void>;
  clearError: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Hook to use the context
export function useAppContext() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
}

// Provider component
interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Action creators
  const loadDogs = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const dogs = await invoke<Dog[]>('get_all_dogs');
      dispatch({ type: 'SET_DOGS', payload: dogs });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to load dogs: ${error}` });
    }
  };

  const addDog = async (dogData: Omit<Dog, 'id' | 'created_at' | 'is_active'>) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await invoke<string>('add_dog', {
        name: dogData.name,
        owner: dogData.owner,
        phone: dogData.phone,
        email: dogData.email,
        breed: dogData.breed,
        age: dogData.age,
        vaccineDate: dogData.vaccine_date || null,
        emergencyContact: dogData.emergency_contact || null,
        emergencyPhone: dogData.emergency_phone || null,
        medicalConditions: dogData.medical_conditions || null,
        dietaryRestrictions: dogData.dietary_restrictions || null,
        behavioralNotes: dogData.behavioral_notes || null,
        photoUrl: dogData.photo_url || null,
      });
      
      // Reload dogs to get the complete dog object
      await loadDogs();
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to add dog: ${error}` });
      throw error;
    }
  };

  const updateDog = async (dog: Dog) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await invoke('update_dog', { dog });
      dispatch({ type: 'UPDATE_DOG', payload: dog });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to update dog: ${error}` });
      throw error;
    }
  };

  const deleteDog = async (id: string) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await invoke('delete_dog', { dogId: id });
      dispatch({ type: 'DELETE_DOG', payload: id });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to delete dog: ${error}` });
      throw error;
    }
  };

  const loadSettings = async () => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      const settings = await invoke<Settings>('get_settings');
      dispatch({ type: 'SET_SETTINGS', payload: settings });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to load settings: ${error}` });
    }
  };

  const updateSettings = async (settings: Settings) => {
    dispatch({ type: 'SET_LOADING', payload: true });
    try {
      await invoke('update_settings', { settings });
      dispatch({ type: 'SET_SETTINGS', payload: settings });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to update settings: ${error}` });
      throw error;
    }
  };

  const loadDayData = async (date: string) => {
    try {
      const dayData = await invoke<DayData | null>('get_day_data', { date });
      if (dayData) {
        dispatch({ type: 'SET_DAY_DATA', payload: { date, data: dayData } });
      }
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to load day data: ${error}` });
    }
  };

  const saveDayData = async (date: string, data: DayData) => {
    try {
      await invoke('save_day_data', { date, dayData: data });
      dispatch({ type: 'SET_DAY_DATA', payload: { date, data } });
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to save day data: ${error}` });
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
      dispatch({ type: 'SET_ERROR', payload: `Failed to export data: ${error}` });
    }
  };

  const importData = async (file: File) => {
    try {
      const text = await file.text();
      await invoke('import_data', { jsonData: text });
      // Reload all data after import
      await Promise.all([loadDogs(), loadSettings()]);
    } catch (error) {
      dispatch({ type: 'SET_ERROR', payload: `Failed to import data: ${error}` });
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'SET_ERROR', payload: null });
  };

  // Initialize data on mount
  useEffect(() => {
    const initialize = async () => {
      await Promise.all([loadDogs(), loadSettings()]);
    };
    
    initialize();
  }, []);

  const contextValue: AppContextType = {
    state,
    dispatch,
    loadDogs,
    addDog,
    updateDog,
    deleteDog,
    loadSettings,
    updateSettings,
    loadDayData,
    saveDayData,
    exportData,
    importData,
    clearError,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}