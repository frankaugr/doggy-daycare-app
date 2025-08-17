use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tauri_plugin_opener::OpenerExt;

mod database;
mod commands;

use database::DatabaseState;

// Legacy data structures for backward compatibility
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LegacyDog {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub phone: String,
    pub email: String,
    pub breed: String,
    pub age: String,
    pub vaccine_date: Option<String>,
    pub consent_last_signed: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyRecord {
    pub checklist: Option<HashMap<String, bool>>,
    pub feeding_times: Option<String>,
    pub drop_off_time: Option<String>,
    pub pick_up_time: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DayAttendance {
    pub dogs: HashMap<String, bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DayData {
    pub attendance: DayAttendance,
    pub records: HashMap<String, DailyRecord>,
    pub am_temp: Option<String>,
    pub pm_temp: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailTemplate {
    pub consent_form: String,
    pub vaccine_reminder: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EmailSubject {
    pub consent_form: String,
    pub vaccine_reminder: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WhatsAppTemplate {
    pub consent_form: String,
    pub vaccine_reminder: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CloudBackupConfig {
    pub enabled: bool,
    pub cloud_directory: String,
    pub max_backups: u32,
    pub sync_interval_minutes: u32,
}

impl Default for CloudBackupConfig {
    fn default() -> Self {
        Self {
            enabled: false,
            cloud_directory: String::new(),
            max_backups: 100,
            sync_interval_minutes: 30,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LegacySettings {
    pub business_name: String,
    #[serde(default = "default_business_phone")]
    pub business_phone: String,
    pub auto_backup: bool,
    #[serde(default)]
    pub cloud_backup: Option<CloudBackupConfig>,
    pub email_templates: EmailTemplate,
    pub email_subjects: EmailSubject,
    #[serde(default = "default_whatsapp_templates")]
    pub whatsapp_templates: WhatsAppTemplate,
}

fn default_business_phone() -> String {
    "".to_string()
}

fn default_whatsapp_templates() -> WhatsAppTemplate {
    WhatsAppTemplate {
        consent_form: "Hi {ownerName}! 🐕 This is a friendly reminder that {dogName} needs their monthly consent form completed for continued daycare services. Please complete it at your earliest convenience. Thanks!".to_string(),
        vaccine_reminder: "Hi {ownerName}! 🐕 Just a reminder that {dogName}'s {vaccineType} vaccination expires on {expirationDate}. Please update their vaccination records to continue daycare services. Thanks!".to_string(),
    }
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AppData {
    pub dogs: Vec<LegacyDog>,
    pub daily_data: HashMap<String, DayData>,
    pub settings: LegacySettings,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            dogs: Vec::new(),
            daily_data: HashMap::new(),
            settings: LegacySettings {
                business_name: "Your Doggy Daycare".to_string(),
                business_phone: "".to_string(),
                auto_backup: true,
                cloud_backup: None,
                email_templates: EmailTemplate {
                    consent_form: "Dear {ownerName},\n\nThis is a friendly reminder that your dog {dogName} needs their monthly consent form completed for continued daycare services.\n\nPlease complete and return the consent form at your earliest convenience. If you have any questions or concerns, please don't hesitate to contact us.\n\nThank you for choosing our daycare services for {dogName}.\n\nBest regards,\nThe Doggy Daycare Team\n\nDate: {currentDate}".to_string(),
                    vaccine_reminder: "Dear {ownerName},\n\nThis is a friendly reminder that your dog {dogName}'s {vaccineType} vaccination is due to expire on {expirationDate}.\n\nTo ensure {dogName} can continue to enjoy our daycare services, please schedule an appointment with your veterinarian to update their vaccination records.\n\nPlease provide us with the updated vaccination certificate once completed.\n\nThank you for keeping {dogName} healthy and safe.\n\nBest regards,\nThe Doggy Daycare Team".to_string(),
                },
                email_subjects: EmailSubject {
                    consent_form: "Monthly Consent Form Required - {dogName}".to_string(),
                    vaccine_reminder: "Vaccine Record Update Required - {dogName}".to_string(),
                },
                whatsapp_templates: default_whatsapp_templates(),
            },
        }
    }
}

// Legacy data file handling functions
fn get_app_data_path() -> Result<PathBuf, String> {
    let is_dev = std::env::var("CARGO_PKG_NAME").is_ok();
    
    let mut path = if is_dev {
        std::env::current_dir().map_err(|e| format!("Failed to get current directory: {}", e))?
    } else {
        let home_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "Failed to get home directory")?;
        PathBuf::from(home_dir)
    };
    
    if is_dev {
        path.push("doggy-daycare-dev-data");
    } else {
        #[cfg(target_os = "windows")]
        path.push("AppData\\Roaming\\doggy-daycare");
        
        #[cfg(not(target_os = "windows"))]
        path.push(".local/share/doggy-daycare");
    }
    
    if !path.exists() {
        fs::create_dir_all(&path).map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    
    path.push("data.json");
    Ok(path)
}

fn load_legacy_data() -> Result<AppData, String> {
    let path = get_app_data_path()?;
    
    if !path.exists() {
        let default_data = AppData::default();
        save_legacy_data(&default_data)?;
        return Ok(default_data);
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| format!("Failed to read data file: {}", e))?;
    
    if content.trim().is_empty() {
        let default_data = AppData::default();
        save_legacy_data(&default_data)?;
        return Ok(default_data);
    }
    
    serde_json::from_str::<AppData>(&content)
        .map_err(|e| format!("Failed to parse data file: {}", e))
}

fn save_legacy_data(data: &AppData) -> Result<(), String> {
    let path = get_app_data_path()?;
    
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;
    
    fs::write(&path, content)
        .map_err(|e| format!("Failed to write data file: {}", e))
}

// Legacy commands for compatibility
#[tauri::command]
async fn open_email(app: tauri::AppHandle, to: String, subject: String, body: String) -> Result<(), String> {
    let mailto_url = format!("mailto:{}?subject={}&body={}", 
        urlencoding::encode(&to),
        urlencoding::encode(&subject),
        urlencoding::encode(&body)
    );
    
    app.opener().open_url(mailto_url, None::<String>)
        .map_err(|e| format!("Failed to open email client: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn update_attendance(date: String, dog_id: String, attending: bool) -> Result<(), String> {
    let mut data = load_legacy_data()?;
    
    let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
        attendance: DayAttendance { dogs: HashMap::new() },
        records: HashMap::new(),
        am_temp: None,
        pm_temp: None,
    });
    
    day_data.attendance.dogs.insert(dog_id, attending);
    save_legacy_data(&data)?;
    
    Ok(())
}

#[tauri::command]
fn update_daily_record(date: String, dog_id: String, record: DailyRecord) -> Result<(), String> {
    let mut data = load_legacy_data()?;
    
    let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
        attendance: DayAttendance { dogs: HashMap::new() },
        records: HashMap::new(),
        am_temp: None,
        pm_temp: None,
    });
    
    day_data.records.insert(dog_id, record);
    save_legacy_data(&data)?;
    
    Ok(())
}

#[tauri::command]
fn update_temperature(date: String, am_temp: Option<String>, pm_temp: Option<String>) -> Result<(), String> {
    let mut data = load_legacy_data()?;
    
    let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
        attendance: DayAttendance { dogs: HashMap::new() },
        records: HashMap::new(),
        am_temp: None,
        pm_temp: None,
    });
    
    if let Some(temp) = am_temp {
        day_data.am_temp = Some(temp);
    }
    if let Some(temp) = pm_temp {
        day_data.pm_temp = Some(temp);
    }
    
    save_legacy_data(&data)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .setup(|app| {
            // Initialize database on startup
            let app_handle = app.handle().clone();
            tauri::async_runtime::spawn(async move {
                if let Err(e) = commands::initialize_database(app_handle.clone()).await {
                    eprintln!("Failed to initialize database: {}", e);
                }
            });
            
            Ok(())
        })
        .manage(DatabaseState::default())
        .invoke_handler(tauri::generate_handler![
            // New database-powered commands
            commands::get_all_dogs,
            commands::add_dog,
            commands::update_dog,
            commands::delete_dog,
            commands::get_day_data,
            commands::save_day_data,
            commands::get_daily_record,
            commands::save_daily_record,
            commands::get_settings,
            commands::update_settings,
            commands::get_cloud_backup_config,
            commands::update_cloud_backup_config,
            commands::export_data,
            commands::import_data,
            commands::save_cloud_backup,
            commands::cleanup_old_backups,
            commands::initialize_database,
            commands::get_database_status,
            // Legacy commands for compatibility during transition
            open_email,
            update_attendance,
            update_daily_record,
            update_temperature
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}