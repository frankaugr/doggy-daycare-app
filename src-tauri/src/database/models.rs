use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Dog {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub phone: String,
    pub email: String,
    pub breed: String,
    pub age: String,
    pub vaccine_date: Option<String>,
    pub consent_last_signed: Option<String>,
    pub emergency_contact: Option<String>,
    pub emergency_phone: Option<String>,
    pub medical_conditions: Option<String>,
    pub dietary_restrictions: Option<String>,
    pub behavioral_notes: Option<String>,
    pub photo_url: Option<String>,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DailyRecord {
    pub id: String,
    pub dog_id: String,
    pub date: String,
    pub checklist: Option<HashMap<String, bool>>,
    pub feeding_times: Option<String>,
    pub drop_off_time: Option<String>,
    pub pick_up_time: Option<String>,
    pub notes: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DayData {
    pub id: String,
    pub date: String,
    pub attendance: AttendanceData,
    pub am_temp: Option<String>,
    pub pm_temp: Option<String>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AttendanceData {
    pub dogs: HashMap<String, bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Settings {
    pub id: String,
    pub business_name: String,
    pub business_phone: String,
    pub business_email: Option<String>,
    pub business_address: Option<String>,
    pub auto_backup: bool,
    pub cloud_backup: Option<CloudBackupConfig>,
    pub email_templates: EmailTemplates,
    pub email_subjects: EmailSubjects,
    pub whatsapp_templates: WhatsAppTemplates,
    pub notification_settings: Option<NotificationSettings>,
    pub created_at: String,
    pub updated_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CloudBackupConfig {
    pub enabled: bool,
    pub cloud_directory: String,
    pub max_backups: i32,
    pub sync_interval_minutes: i32,
    pub last_sync: Option<String>,
    pub auto_sync_on_startup: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailTemplates {
    pub consent_form: String,
    pub vaccine_reminder: String,
    pub pickup_reminder: Option<String>,
    pub welcome_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EmailSubjects {
    pub consent_form: String,
    pub vaccine_reminder: String,
    pub pickup_reminder: Option<String>,
    pub welcome_message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WhatsAppTemplates {
    pub consent_form: String,
    pub vaccine_reminder: String,
    pub pickup_reminder: Option<String>,
    pub daily_update: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationSettings {
    pub email_enabled: bool,
    pub whatsapp_enabled: bool,
    pub desktop_notifications: bool,
    pub reminder_advance_days: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncOperation {
    pub id: String,
    pub operation_type: String, // CREATE, UPDATE, DELETE
    pub entity_type: String,    // dog, daily_record, day_data, settings
    pub entity_data: serde_json::Value,
    pub created_at: String,
    pub retries: i32,
    pub max_retries: i32,
    pub last_attempt: Option<String>,
    pub status: String, // pending, processing, completed, failed
}

// Input types for creating new records
#[derive(Debug, Deserialize)]
pub struct CreateDogInput {
    pub name: String,
    pub owner: String,
    pub phone: String,
    pub email: String,
    pub breed: String,
    pub age: String,
    pub vaccine_date: Option<String>,
    pub emergency_contact: Option<String>,
    pub emergency_phone: Option<String>,
    pub medical_conditions: Option<String>,
    pub dietary_restrictions: Option<String>,
    pub behavioral_notes: Option<String>,
    pub photo_url: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDailyRecordInput {
    pub dog_id: String,
    pub date: String,
    pub checklist: Option<HashMap<String, bool>>,
    pub feeding_times: Option<String>,
    pub drop_off_time: Option<String>,
    pub pick_up_time: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDayDataInput {
    pub date: String,
    pub attendance: AttendanceData,
    pub am_temp: Option<String>,
    pub pm_temp: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct ExportData {
    pub dogs: Vec<Dog>,
    pub daily_records: Vec<DailyRecord>,
    pub day_data: Vec<DayData>,
    pub settings: Settings,
    pub exported_at: String,
    pub version: String,
}

#[derive(Debug, Deserialize)]
pub struct ImportData {
    pub dogs: Option<Vec<Dog>>,
    pub daily_records: Option<Vec<DailyRecord>>,
    pub day_data: Option<Vec<DayData>>,
    pub settings: Option<Settings>,
    pub exported_at: Option<String>,
    pub version: Option<String>,
}