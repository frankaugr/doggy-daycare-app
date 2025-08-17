use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tauri_plugin_opener::OpenerExt;

mod database;
mod commands;

use database::{Database, DatabaseState};


#[derive(Debug, Serialize, Deserialize, Clone)]
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
pub struct Settings {
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
    pub dogs: Vec<Dog>,
    pub daily_data: HashMap<String, DayData>,
    pub settings: Settings,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            dogs: Vec::new(),
            daily_data: HashMap::new(),
            settings: Settings {
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

fn is_development_mode() -> bool {
    // Check if we're in a development environment
    // This can be detected by checking for WSL, or by checking if we're in the src-tauri directory
    std::env::var("WSL_DISTRO_NAME").is_ok() || 
    std::env::var("CARGO_PKG_NAME").is_ok() ||
    std::env::current_dir()
        .map(|dir| dir.to_string_lossy().contains("src-tauri"))
        .unwrap_or(false)
}

fn get_app_data_path() -> Result<PathBuf, String> {
    let is_dev = is_development_mode();
    println!("Running in {} mode", if is_dev { "development" } else { "production" });
    
    let mut path = if is_dev {
        // Development mode: store in current project directory or user's home
        if let Ok(current_dir) = std::env::current_dir() {
            // If we're in src-tauri, go up one level to the project root
            if current_dir.file_name().map_or(false, |name| name == "src-tauri") {
                current_dir.parent().unwrap_or(&current_dir).to_path_buf()
            } else {
                current_dir
            }
        } else {
            // Fallback to home directory
            let home_dir = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .map_err(|_| "Failed to get home directory")?;
            PathBuf::from(home_dir)
        }
    } else {
        // Production mode: use appropriate OS-specific directories
        let home_dir = std::env::var("HOME")
            .or_else(|_| std::env::var("USERPROFILE"))
            .map_err(|_| "Failed to get home directory")?;
        PathBuf::from(home_dir)
    };
    
    // Add the app-specific subdirectory
    if is_dev {
        path.push("doggy-daycare-dev-data");
    } else {
        // Use OS-specific app data directories
        #[cfg(target_os = "windows")]
        path.push("AppData\\Roaming\\doggy-daycare");
        
        #[cfg(not(target_os = "windows"))]
        path.push(".local/share/doggy-daycare");
    }
    
    println!("App data directory: {:?}", path);
    
    if !path.exists() {
        println!("Creating directory: {:?}", path);
        fs::create_dir_all(&path).map_err(|e| format!("Failed to create app data directory: {}", e))?;
    }
    
    path.push("data.json");
    println!("Data file path: {:?}", path);
    Ok(path)
}

fn load_app_data() -> Result<AppData, String> {
    let path = get_app_data_path()?;
    
    println!("Loading app data from: {:?}", path);
    
    if !path.exists() {
        println!("Data file doesn't exist, creating default");
        let default_data = AppData::default();
        save_app_data(&default_data)?;
        return Ok(default_data);
    }
    
    let content = fs::read_to_string(&path)
        .map_err(|e| {
            println!("Failed to read data file: {}", e);
            format!("Failed to read data file: {}", e)
        })?;
    
    if content.trim().is_empty() {
        println!("Data file is empty, creating default");
        let default_data = AppData::default();
        save_app_data(&default_data)?;
        return Ok(default_data);
    }
    
    println!("Parsing data file content");
    
    // Try to parse normally first
    match serde_json::from_str::<AppData>(&content) {
        Ok(data) => {
            println!("Successfully parsed data file");
            Ok(data)
        },
        Err(e) => {
            println!("Failed to parse data file, attempting migration: {}", e);
            
            // Try to parse as a generic JSON value to perform migration
            match serde_json::from_str::<serde_json::Value>(&content) {
                Ok(mut json_data) => {
                    println!("Successfully parsed as JSON, performing migration");
                    
                    // Migrate settings if needed
                    if let Some(settings) = json_data.get_mut("settings") {
                        migrate_settings(settings);
                    }
                    
                    // Try to parse the migrated data
                    match serde_json::from_value::<AppData>(json_data) {
                        Ok(migrated_data) => {
                            println!("Successfully migrated data, saving updated version");
                            // Save the migrated data to update the file
                            save_app_data(&migrated_data)?;
                            Ok(migrated_data)
                        },
                        Err(migration_error) => {
                            println!("Migration failed: {}", migration_error);
                            Err(format!("Failed to migrate data: {}", migration_error))
                        }
                    }
                },
                Err(json_error) => {
                    println!("Failed to parse as JSON: {}", json_error);
                    Err(format!("Failed to parse data file: {}", e))
                }
            }
        }
    }
}

fn migrate_settings(settings: &mut serde_json::Value) {
    println!("Migrating settings");
    
    // Add business_phone if missing
    if !settings.get("business_phone").is_some() {
        println!("Adding missing business_phone field");
        settings["business_phone"] = serde_json::Value::String("".to_string());
    }
    
    // Add whatsapp_templates if missing
    if !settings.get("whatsapp_templates").is_some() {
        println!("Adding missing whatsapp_templates field");
        settings["whatsapp_templates"] = serde_json::json!({
            "consent_form": "Hi {ownerName}! 🐕 This is a friendly reminder that {dogName} needs their monthly consent form completed for continued daycare services. Please complete it at your earliest convenience. Thanks!",
            "vaccine_reminder": "Hi {ownerName}! 🐕 Just a reminder that {dogName}'s {vaccineType} vaccination expires on {expirationDate}. Please update their vaccination records to continue daycare services. Thanks!"
        });
    }
    
    println!("Settings migration completed");
}

fn save_app_data(data: &AppData) -> Result<(), String> {
    let path = get_app_data_path()?;
    
    println!("Saving app data to: {:?}", path);
    
    let content = serde_json::to_string_pretty(data)
        .map_err(|e| {
            println!("Failed to serialize data: {}", e);
            format!("Failed to serialize data: {}", e)
        })?;
    
    fs::write(&path, content)
        .map_err(|e| {
            println!("Failed to write data file: {}", e);
            format!("Failed to write data file: {}", e)
        })
}

#[tauri::command]
fn get_all_dogs() -> Result<Vec<Dog>, String> {
    let data = load_app_data()?;
    Ok(data.dogs)
}

#[tauri::command]
fn add_dog(name: String, owner: String, phone: String, email: String, breed: String, age: String, vaccine_date: Option<String>) -> Result<Dog, String> {
    let mut data = load_app_data()?;
    
    let dog = Dog {
        id: Uuid::new_v4().to_string(),
        name,
        owner,
        phone,
        email,
        breed,
        age,
        vaccine_date,
        consent_last_signed: None,
        created_at: Utc::now(),
    };
    
    data.dogs.push(dog.clone());
    save_app_data(&data)?;
    
    Ok(dog)
}

#[tauri::command]
fn update_dog(dog: Dog) -> Result<(), String> {
    let mut data = load_app_data()?;
    
    if let Some(index) = data.dogs.iter().position(|d| d.id == dog.id) {
        data.dogs[index] = dog;
        save_app_data(&data)?;
        Ok(())
    } else {
        Err("Dog not found".to_string())
    }
}

#[tauri::command]
fn delete_dog(dog_id: String) -> Result<(), String> {
    let mut data = load_app_data()?;
    
    if let Some(index) = data.dogs.iter().position(|d| d.id == dog_id) {
        data.dogs.remove(index);
        save_app_data(&data)?;
        Ok(())
    } else {
        Err("Dog not found".to_string())
    }
}

#[tauri::command]
fn get_daily_data(date: String) -> Result<Option<DayData>, String> {
    let data = load_app_data()?;
    Ok(data.daily_data.get(&date).cloned())
}

#[tauri::command]
fn update_attendance(date: String, dog_id: String, attending: bool) -> Result<(), String> {
    let mut data = load_app_data()?;
    
    let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
        attendance: DayAttendance { dogs: HashMap::new() },
        records: HashMap::new(),
        am_temp: None,
        pm_temp: None,
    });
    
    day_data.attendance.dogs.insert(dog_id, attending);
    save_app_data(&data)?;
    
    Ok(())
}

#[tauri::command]
fn update_daily_record(date: String, dog_id: String, record: DailyRecord) -> Result<(), String> {
    let mut data = load_app_data()?;
    
    let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
        attendance: DayAttendance { dogs: HashMap::new() },
        records: HashMap::new(),
        am_temp: None,
        pm_temp: None,
    });
    
    day_data.records.insert(dog_id, record);
    save_app_data(&data)?;
    
    Ok(())
}

#[tauri::command]
fn update_temperature(date: String, am_temp: Option<String>, pm_temp: Option<String>) -> Result<(), String> {
    let mut data = load_app_data()?;
    
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
    
    save_app_data(&data)?;
    Ok(())
}

#[tauri::command]
fn get_settings() -> Result<Settings, String> {
    println!("Getting settings...");
    println!("Environment detection: {}", if is_development_mode() { "Development" } else { "Production" });
    let data = load_app_data()?;
    println!("Settings loaded successfully");
    Ok(data.settings)
}

#[tauri::command]
fn update_settings(settings: Settings) -> Result<(), String> {
    let mut data = load_app_data()?;
    data.settings = settings;
    save_app_data(&data)?;
    Ok(())
}

#[tauri::command]
async fn open_email(app: tauri::AppHandle, to: String, subject: String, body: String) -> Result<(), String> {
    let mailto_url = format!("mailto:{}?subject={}&body={}", 
        urlencoding::encode(&to),
        urlencoding::encode(&subject),
        urlencoding::encode(&body)
    );
    
    println!("Opening email URL: {}", mailto_url);
    
    app.opener().open_url(mailto_url, None::<String>)
        .map_err(|e| format!("Failed to open email client: {}", e))?;
    
    Ok(())
}

#[tauri::command]
fn export_data() -> Result<String, String> {
    let data = load_app_data()?;
    serde_json::to_string_pretty(&data)
        .map_err(|e| format!("Failed to export data: {}", e))
}

#[tauri::command]
fn import_data(json_data: String) -> Result<(), String> {
    let data: AppData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;
    
    save_app_data(&data)?;
    Ok(())
}

#[tauri::command]
fn get_cloud_backup_config() -> Result<CloudBackupConfig, String> {
    let data = load_app_data()?;
    Ok(data.settings.cloud_backup.unwrap_or_default())
}

#[tauri::command]
fn update_cloud_backup_config(config: CloudBackupConfig) -> Result<(), String> {
    let mut data = load_app_data()?;
    data.settings.cloud_backup = Some(config);
    save_app_data(&data)?;
    Ok(())
}

#[tauri::command]
fn save_cloud_backup(cloud_directory: String, filename: String, data: String) -> Result<(), String> {
    let cloud_path = PathBuf::from(&cloud_directory);
    
    if !cloud_path.exists() {
        return Err(format!("Cloud directory does not exist: {}", cloud_directory));
    }
    
    if !cloud_path.is_dir() {
        return Err(format!("Cloud path is not a directory: {}", cloud_directory));
    }
    
    let backup_path = cloud_path.join(&filename);
    
    fs::write(&backup_path, data)
        .map_err(|e| format!("Failed to write backup to {}: {}", backup_path.display(), e))?;
    
    println!("Successfully saved backup to: {}", backup_path.display());
    Ok(())
}

#[tauri::command]
fn cleanup_old_backups(cloud_directory: String, max_backups: u32) -> Result<(), String> {
    let cloud_path = PathBuf::from(&cloud_directory);
    
    if !cloud_path.exists() || !cloud_path.is_dir() {
        return Ok(()); // Nothing to clean up
    }
    
    // Get all backup files
    let mut backup_files = Vec::new();
    
    match fs::read_dir(&cloud_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if let Some(filename) = path.file_name() {
                        if let Some(filename_str) = filename.to_str() {
                            if filename_str.starts_with("doggy-daycare-backup-") && filename_str.ends_with(".json") {
                                if let Ok(metadata) = entry.metadata() {
                                    if let Ok(modified) = metadata.modified() {
                                        backup_files.push((path, modified));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        Err(e) => {
            return Err(format!("Failed to read cloud directory: {}", e));
        }
    }
    
    // Sort by modification time (newest first)
    backup_files.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Remove files beyond the limit
    if backup_files.len() > max_backups as usize {
        let files_to_remove = &backup_files[max_backups as usize..];
        
        for (file_path, _) in files_to_remove {
            match fs::remove_file(file_path) {
                Ok(_) => println!("Removed old backup: {}", file_path.display()),
                Err(e) => println!("Failed to remove old backup {}: {}", file_path.display(), e),
            }
        }
    }
    
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
            // Deprecated - will be removed
            get_daily_data as legacy_get_daily_data,
            update_attendance,
            update_daily_record,
            update_temperature
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}