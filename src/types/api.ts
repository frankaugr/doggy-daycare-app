// Tauri API Command Types
export interface TauriCommands {
  // Dog Management
  get_all_dogs(): Promise<Dog[]>;
  add_dog(params: AddDogParams): Promise<string>;
  update_dog(params: UpdateDogParams): Promise<void>;
  delete_dog(params: DeleteDogParams): Promise<void>;
  
  // Daily Records
  get_day_data(params: GetDayDataParams): Promise<DayData | null>;
  save_day_data(params: SaveDayDataParams): Promise<void>;
  get_daily_record(params: GetDailyRecordParams): Promise<DailyRecord | null>;
  save_daily_record(params: SaveDailyRecordParams): Promise<void>;
  
  // Settings
  get_settings(): Promise<Settings>;
  update_settings(params: UpdateSettingsParams): Promise<void>;
  
  // Backup and Import/Export
  export_data(): Promise<string>;
  import_data(params: ImportDataParams): Promise<void>;
  save_cloud_backup(params: SaveCloudBackupParams): Promise<void>;
  cleanup_old_backups(params: CleanupBackupsParams): Promise<void>;
  
  // Cloud Backup Configuration
  get_cloud_backup_config(): Promise<CloudBackupConfig>;
  update_cloud_backup_config(params: UpdateCloudBackupConfigParams): Promise<void>;
  
  // Database Operations
  initialize_database(): Promise<void>;
  run_migrations(): Promise<void>;
  get_database_status(): Promise<DatabaseStatus>;
  
  // Sync Operations
  get_pending_sync_operations(): Promise<SyncOperation[]>;
  add_sync_operation(params: AddSyncOperationParams): Promise<void>;
  remove_sync_operation(params: RemoveSyncOperationParams): Promise<void>;
  process_sync_queue(): Promise<SyncResult>;
}

// Parameter Types for Tauri Commands
export interface AddDogParams {
  name: string;
  owner: string;
  phone: string;
  email: string;
  breed: string;
  age: string;
  vaccineDate?: string | null;
  emergencyContact?: string;
  emergencyPhone?: string;
  medicalConditions?: string;
  dietaryRestrictions?: string;
  behavioralNotes?: string;
  photoUrl?: string;
}

export interface UpdateDogParams {
  dog: Dog;
}

export interface DeleteDogParams {
  dogId: string;
}

export interface GetDayDataParams {
  date: string;
}

export interface SaveDayDataParams {
  date: string;
  dayData: DayData;
}

export interface GetDailyRecordParams {
  dogId: string;
  date: string;
}

export interface SaveDailyRecordParams {
  dogId: string;
  date: string;
  record: DailyRecord;
}

export interface UpdateSettingsParams {
  settings: Settings;
}

export interface ImportDataParams {
  jsonData: string;
}

export interface SaveCloudBackupParams {
  cloudDirectory: string;
  filename: string;
  data: string;
}

export interface CleanupBackupsParams {
  cloudDirectory: string;
  maxBackups: number;
}

export interface UpdateCloudBackupConfigParams {
  config: CloudBackupConfig;
}

export interface AddSyncOperationParams {
  operation: SyncOperation;
}

export interface RemoveSyncOperationParams {
  operationId: string;
}

// Response Types
export interface DatabaseStatus {
  isInitialized: boolean;
  version: number;
  lastMigration?: string;
  hasPendingMigrations: boolean;
}

export interface SyncResult {
  processed: number;
  successful: number;
  failed: number;
  errors: string[];
}

// Import necessary types
import type { 
  Dog, 
  DayData, 
  DailyRecord, 
  Settings, 
  CloudBackupConfig,
  SyncOperation 
} from './index';