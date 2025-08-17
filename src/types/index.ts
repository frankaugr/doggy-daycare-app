// Core Entity Types
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
  updated_at?: string;
  is_active: boolean;
  // New fields for enhanced functionality
  emergency_contact?: string;
  emergency_phone?: string;
  medical_conditions?: string;
  dietary_restrictions?: string;
  behavioral_notes?: string;
  photo_url?: string;
}

export interface DailyRecord {
  id?: string;
  dog_id: string;
  date: string;
  checklist?: Record<string, boolean>;
  feeding_times?: string;
  drop_off_time?: string;
  pick_up_time?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DayData {
  id?: string;
  date: string;
  attendance: {
    dogs: Record<string, boolean>;
  };
  records: Record<string, DailyRecord>;
  am_temp?: string;
  pm_temp?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Settings {
  id?: string;
  business_name: string;
  business_phone: string;
  business_email?: string;
  business_address?: string;
  auto_backup: boolean;
  cloud_backup?: CloudBackupConfig;
  email_templates: EmailTemplates;
  email_subjects: EmailSubjects;
  whatsapp_templates: WhatsAppTemplates;
  notification_settings?: NotificationSettings;
  created_at?: string;
  updated_at?: string;
}

// Configuration Types
export interface CloudBackupConfig {
  enabled: boolean;
  cloud_directory: string;
  max_backups: number;
  sync_interval_minutes: number;
  last_sync?: string;
  auto_sync_on_startup: boolean;
}

export interface EmailTemplates {
  consent_form: string;
  vaccine_reminder: string;
  pickup_reminder?: string;
  welcome_message?: string;
}

export interface EmailSubjects {
  consent_form: string;
  vaccine_reminder: string;
  pickup_reminder?: string;
  welcome_message?: string;
}

export interface WhatsAppTemplates {
  consent_form: string;
  vaccine_reminder: string;
  pickup_reminder?: string;
  daily_update?: string;
}

export interface NotificationSettings {
  email_enabled: boolean;
  whatsapp_enabled: boolean;
  desktop_notifications: boolean;
  reminder_advance_days: number;
}

// State Management Types
export interface AppState {
  dogs: Dog[];
  dayData: Record<string, DayData>;
  settings: Settings | null;
  connectionStatus: ConnectionStatus;
  loading: boolean;
  error: string | null;
  syncQueue: SyncOperation[];
}

export interface ConnectionStatus {
  online: boolean;
  lastCheck: Date;
  lastSync?: Date;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

// Sync and Offline Types
export interface SyncOperation {
  id: string;
  operation: 'CREATE' | 'UPDATE' | 'DELETE';
  entity: 'dog' | 'daily_record' | 'day_data' | 'settings';
  data: any;
  timestamp: Date;
  retries: number;
  max_retries: number;
}

export interface OfflineQueueItem {
  id: string;
  operation: SyncOperation;
  status: 'pending' | 'syncing' | 'completed' | 'failed';
  created_at: Date;
  last_attempt?: Date;
}

// UI Component Types
export type Tab = 'daily' | 'management' | 'compliance' | 'settings' | 'reports';

export interface FormErrors {
  [key: string]: string | undefined;
}

export interface ValidationResult {
  isValid: boolean;
  errors: FormErrors;
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Search and Filter Types
export interface SearchFilters {
  searchTerm?: string;
  breed?: string;
  ageRange?: [number, number];
  isActive?: boolean;
  hasVaccination?: boolean;
  hasConsent?: boolean;
  dateRange?: [string, string];
}

export interface SortOptions {
  field: keyof Dog | keyof DailyRecord;
  direction: 'asc' | 'desc';
}

// Checklist Types
export interface ChecklistCategory {
  id: string;
  name: string;
  items: ChecklistItem[];
}

export interface ChecklistItem {
  id: string;
  label: string;
  required: boolean;
  category: string;
}

// Compliance Types
export interface ComplianceAlert {
  id: string;
  dog_id: string;
  dog_name: string;
  type: 'vaccine_expired' | 'vaccine_expiring' | 'consent_expired' | 'consent_expiring';
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  due_date?: string;
  days_overdue?: number;
}

// Event Types for Context
export type AppAction = 
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_DOGS'; payload: Dog[] }
  | { type: 'ADD_DOG'; payload: Dog }
  | { type: 'UPDATE_DOG'; payload: Dog }
  | { type: 'DELETE_DOG'; payload: string }
  | { type: 'SET_DAY_DATA'; payload: { date: string; data: DayData } }
  | { type: 'SET_SETTINGS'; payload: Settings }
  | { type: 'SET_CONNECTION_STATUS'; payload: ConnectionStatus }
  | { type: 'ADD_SYNC_OPERATION'; payload: SyncOperation }
  | { type: 'REMOVE_SYNC_OPERATION'; payload: string }
  | { type: 'CLEAR_SYNC_QUEUE' };

// Hook Types
export interface UseDogsReturn {
  dogs: Dog[];
  loading: boolean;
  error: string | null;
  addDog: (dog: Omit<Dog, 'id' | 'created_at' | 'is_active'>) => Promise<void>;
  updateDog: (dog: Dog) => Promise<void>;
  deleteDog: (id: string) => Promise<void>;
  searchDogs: (filters: SearchFilters) => Dog[];
  refreshDogs: () => Promise<void>;
}

export interface UseOfflineSyncReturn {
  isOnline: boolean;
  syncQueue: SyncOperation[];
  queueSize: number;
  issyncing: boolean;
  lastSync: Date | null;
  addToQueue: (operation: SyncOperation) => void;
  processQueue: () => Promise<void>;
  clearQueue: () => void;
}

// Utility Types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

export type OptionalFields<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

// Database Migration Types
export interface Migration {
  version: number;
  description: string;
  up: string;
  down: string;
}

// Export all types
export * from './api';
export * from './database';