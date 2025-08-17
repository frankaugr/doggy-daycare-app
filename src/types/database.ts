// Database Schema Types
export interface DatabaseSchema {
  dogs: DogEntity;
  daily_records: DailyRecordEntity;
  day_data: DayDataEntity;
  settings: SettingsEntity;
  sync_operations: SyncOperationEntity;
  migrations: MigrationEntity;
}

// Database Entity Types (matching SQLite schema)
export interface DogEntity {
  id: string;
  name: string;
  owner: string;
  phone: string;
  email: string;
  breed: string;
  age: string;
  vaccine_date?: string;
  consent_last_signed?: string;
  emergency_contact?: string;
  emergency_phone?: string;
  medical_conditions?: string;
  dietary_restrictions?: string;
  behavioral_notes?: string;
  photo_url?: string;
  is_active: number; // SQLite uses INTEGER for boolean
  created_at: string;
  updated_at?: string;
}

export interface DailyRecordEntity {
  id: string;
  dog_id: string;
  date: string;
  checklist: string; // JSON string
  feeding_times?: string;
  drop_off_time?: string;
  pick_up_time?: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
}

export interface DayDataEntity {
  id: string;
  date: string;
  attendance: string; // JSON string
  am_temp?: string;
  pm_temp?: string;
  created_at: string;
  updated_at?: string;
}

export interface SettingsEntity {
  id: string;
  business_name: string;
  business_phone: string;
  business_email?: string;
  business_address?: string;
  auto_backup: number; // SQLite boolean
  cloud_backup_config: string; // JSON string
  email_templates: string; // JSON string
  email_subjects: string; // JSON string
  whatsapp_templates: string; // JSON string
  notification_settings: string; // JSON string
  created_at: string;
  updated_at?: string;
}

export interface SyncOperationEntity {
  id: string;
  operation_type: string; // 'CREATE' | 'UPDATE' | 'DELETE'
  entity_type: string; // 'dog' | 'daily_record' | 'day_data' | 'settings'
  entity_data: string; // JSON string
  created_at: string;
  retries: number;
  max_retries: number;
  last_attempt?: string;
  status: string; // 'pending' | 'processing' | 'completed' | 'failed'
}

export interface MigrationEntity {
  id: number;
  version: number;
  description: string;
  executed_at: string;
}

// Query Builder Types
export interface QueryCondition {
  field: string;
  operator: '=' | '!=' | '>' | '<' | '>=' | '<=' | 'LIKE' | 'IN' | 'NOT IN';
  value: any;
}

export interface QueryOptions {
  where?: QueryCondition[];
  orderBy?: { field: string; direction: 'ASC' | 'DESC' }[];
  limit?: number;
  offset?: number;
}

export interface InsertOptions {
  onConflict?: 'IGNORE' | 'REPLACE' | 'ROLLBACK';
}

export interface UpdateOptions {
  where: QueryCondition[];
}

// Database Transaction Types
export interface TransactionCallback<T = any> {
  (): Promise<T>;
}

export interface DatabaseTransaction {
  execute<T>(callback: TransactionCallback<T>): Promise<T>;
  rollback(): Promise<void>;
  commit(): Promise<void>;
}

// Database Migration Types
export interface DatabaseMigration {
  version: number;
  description: string;
  up: (db: DatabaseConnection) => Promise<void>;
  down: (db: DatabaseConnection) => Promise<void>;
}

export interface DatabaseConnection {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  transaction<T>(callback: TransactionCallback<T>): Promise<T>;
}

// Repository Pattern Types
export interface Repository<T, CreateT = Omit<T, 'id' | 'created_at' | 'updated_at'>> {
  findAll(options?: QueryOptions): Promise<T[]>;
  findById(id: string): Promise<T | null>;
  findOne(conditions: QueryCondition[]): Promise<T | null>;
  create(data: CreateT): Promise<T>;
  update(id: string, data: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
  count(conditions?: QueryCondition[]): Promise<number>;
}

// Database Error Types
export class DatabaseError extends Error {
  constructor(
    message: string,
    public code?: string,
    public query?: string,
    public params?: any[]
  ) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public version?: number,
    public migration?: string
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'TransactionError';
  }
}