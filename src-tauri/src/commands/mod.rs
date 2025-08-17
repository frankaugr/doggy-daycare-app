use tauri::{State, AppHandle, Manager};
use anyhow::Result;

use crate::database::{Database, DatabaseState};
use crate::database::models::*;
use crate::database::repositories::*;

// Dog Management Commands
#[tauri::command]
pub async fn get_all_dogs(state: State<'_, DatabaseState>) -> Result<Vec<Dog>, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DogRepository::new(db.pool().clone());
    
    repo.find_all().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn add_dog(
    name: String,
    owner: String,
    phone: String,
    email: String,
    breed: String,
    age: String,
    vaccine_date: Option<String>,
    emergency_contact: Option<String>,
    emergency_phone: Option<String>,
    medical_conditions: Option<String>,
    dietary_restrictions: Option<String>,
    behavioral_notes: Option<String>,
    photo_url: Option<String>,
    state: State<'_, DatabaseState>
) -> Result<String, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DogRepository::new(db.pool().clone());
    
    let input = CreateDogInput {
        name,
        owner,
        phone,
        email,
        breed,
        age,
        vaccine_date,
        emergency_contact,
        emergency_phone,
        medical_conditions,
        dietary_restrictions,
        behavioral_notes,
        photo_url,
    };
    
    let dog = repo.create(input).await.map_err(|e| e.to_string())?;
    Ok(dog.id)
}

#[tauri::command]
pub async fn update_dog(dog: Dog, state: State<'_, DatabaseState>) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DogRepository::new(db.pool().clone());
    
    repo.update(dog).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn delete_dog(dog_id: String, state: State<'_, DatabaseState>) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DogRepository::new(db.pool().clone());
    
    repo.delete(&dog_id).await.map_err(|e| e.to_string())?;
    Ok(())
}

// Daily Records Commands
#[tauri::command]
pub async fn get_day_data(date: String, state: State<'_, DatabaseState>) -> Result<Option<DayData>, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DayDataRepository::new(db.pool().clone());
    
    repo.find_by_date(&date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_day_data(date: String, day_data: DayData, state: State<'_, DatabaseState>) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DayDataRepository::new(db.pool().clone());
    
    let input = CreateDayDataInput {
        date,
        attendance: day_data.attendance,
        am_temp: day_data.am_temp,
        pm_temp: day_data.pm_temp,
    };
    
    repo.create_or_update(input).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_daily_record(
    dog_id: String,
    date: String,
    state: State<'_, DatabaseState>
) -> Result<Option<DailyRecord>, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DailyRecordRepository::new(db.pool().clone());
    
    repo.find_by_dog_and_date(&dog_id, &date).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_daily_record(
    dog_id: String,
    date: String,
    record: DailyRecord,
    state: State<'_, DatabaseState>
) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = DailyRecordRepository::new(db.pool().clone());
    
    let input = CreateDailyRecordInput {
        dog_id,
        date,
        checklist: record.checklist,
        feeding_times: record.feeding_times,
        drop_off_time: record.drop_off_time,
        pick_up_time: record.pick_up_time,
        notes: record.notes,
    };
    
    repo.create_or_update(input).await.map_err(|e| e.to_string())?;
    Ok(())
}

// Settings Commands
#[tauri::command]
pub async fn get_settings(state: State<'_, DatabaseState>) -> Result<Settings, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = SettingsRepository::new(db.pool().clone());
    
    repo.get().await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn update_settings(settings: Settings, state: State<'_, DatabaseState>) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = SettingsRepository::new(db.pool().clone());
    
    repo.update(settings).await.map_err(|e| e.to_string())?;
    Ok(())
}

// Cloud Backup Commands
#[tauri::command]
pub async fn get_cloud_backup_config(state: State<'_, DatabaseState>) -> Result<CloudBackupConfig, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = SettingsRepository::new(db.pool().clone());
    
    let settings = repo.get().await.map_err(|e| e.to_string())?;
    Ok(settings.cloud_backup.unwrap_or_else(|| CloudBackupConfig {
        enabled: false,
        cloud_directory: String::new(),
        max_backups: 100,
        sync_interval_minutes: 30,
        last_sync: None,
        auto_sync_on_startup: true,
    }))
}

#[tauri::command]
pub async fn update_cloud_backup_config(
    config: CloudBackupConfig,
    state: State<'_, DatabaseState>
) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    let repo = SettingsRepository::new(db.pool().clone());
    
    let mut settings = repo.get().await.map_err(|e| e.to_string())?;
    settings.cloud_backup = Some(config);
    
    repo.update(settings).await.map_err(|e| e.to_string())?;
    Ok(())
}

// Import/Export Commands
#[tauri::command]
pub async fn export_data(state: State<'_, DatabaseState>) -> Result<String, String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    
    let dog_repo = DogRepository::new(db.pool().clone());
    let settings_repo = SettingsRepository::new(db.pool().clone());
    
    // For now, export just dogs and settings
    // TODO: Add daily records and day data
    let dogs = dog_repo.find_all().await.map_err(|e| e.to_string())?;
    let settings = settings_repo.get().await.map_err(|e| e.to_string())?;
    
    let export_data = ExportData {
        dogs,
        daily_records: vec![], // TODO: Implement
        day_data: vec![], // TODO: Implement
        settings,
        exported_at: crate::database::current_timestamp(),
        version: "2.0".to_string(),
    };
    
    serde_json::to_string_pretty(&export_data).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn import_data(json_data: String, state: State<'_, DatabaseState>) -> Result<(), String> {
    let db = state.get_db().map_err(|e| e.to_string())?;
    
    let import_data: ImportData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;
    
    // TODO: Implement proper transaction support
    // let mut tx = db.begin_transaction().await.map_err(|e| e.to_string())?;
    
    // Import settings if provided
    if let Some(settings) = import_data.settings {
        let repo = SettingsRepository::new(db.pool().clone());
        repo.update(settings).await.map_err(|e| e.to_string())?;
    }
    
    // Import dogs if provided
    if let Some(dogs) = import_data.dogs {
        let repo = DogRepository::new(db.pool().clone());
        for dog in dogs {
            let input = CreateDogInput {
                name: dog.name,
                owner: dog.owner,
                phone: dog.phone,
                email: dog.email,
                breed: dog.breed,
                age: dog.age,
                vaccine_date: dog.vaccine_date,
                emergency_contact: dog.emergency_contact,
                emergency_phone: dog.emergency_phone,
                medical_conditions: dog.medical_conditions,
                dietary_restrictions: dog.dietary_restrictions,
                behavioral_notes: dog.behavioral_notes,
                photo_url: dog.photo_url,
            };
            repo.create(input).await.map_err(|e| e.to_string())?;
        }
    }
    
    // TODO: Import daily records and day data
    
    // tx.commit().await.map_err(|e| e.to_string())?;
    Ok(())
}

// File operations for cloud backup
#[tauri::command]
pub async fn save_cloud_backup(
    cloud_directory: String,
    filename: String,
    data: String
) -> Result<(), String> {
    use std::path::PathBuf;
    use tokio::fs;
    
    let cloud_path = PathBuf::from(&cloud_directory);
    
    if !cloud_path.exists() {
        return Err(format!("Cloud directory does not exist: {}", cloud_directory));
    }
    
    if !cloud_path.is_dir() {
        return Err(format!("Cloud path is not a directory: {}", cloud_directory));
    }
    
    let backup_path = cloud_path.join(&filename);
    
    fs::write(&backup_path, data).await
        .map_err(|e| format!("Failed to write backup to {}: {}", backup_path.display(), e))?;
    
    println!("Successfully saved backup to: {}", backup_path.display());
    Ok(())
}

#[tauri::command]
pub async fn cleanup_old_backups(
    cloud_directory: String,
    max_backups: i32
) -> Result<(), String> {
    use std::path::PathBuf;
    use tokio::fs;
    
    let cloud_path = PathBuf::from(&cloud_directory);
    
    if !cloud_path.exists() || !cloud_path.is_dir() {
        return Ok(()); // Nothing to clean up
    }
    
    // Get all backup files
    let mut backup_files = Vec::new();
    
    let mut entries = fs::read_dir(&cloud_path).await
        .map_err(|e| format!("Failed to read cloud directory: {}", e))?;
    
    while let Some(entry) = entries.next_entry().await
        .map_err(|e| format!("Failed to read directory entry: {}", e))? {
        
        let path = entry.path();
        if let Some(filename) = path.file_name() {
            if let Some(filename_str) = filename.to_str() {
                if filename_str.starts_with("doggy-daycare-backup-") && filename_str.ends_with(".json") {
                    if let Ok(metadata) = entry.metadata().await {
                        if let Ok(modified) = metadata.modified() {
                            backup_files.push((path, modified));
                        }
                    }
                }
            }
        }
    }
    
    // Sort by modification time (newest first)
    backup_files.sort_by(|a, b| b.1.cmp(&a.1));
    
    // Remove files beyond the limit
    if backup_files.len() > max_backups as usize {
        let files_to_remove = &backup_files[max_backups as usize..];
        
        for (file_path, _) in files_to_remove {
            match fs::remove_file(file_path).await {
                Ok(_) => println!("Removed old backup: {}", file_path.display()),
                Err(e) => println!("Failed to remove old backup {}: {}", file_path.display(), e),
            }
        }
    }
    
    Ok(())
}

// Database management commands
#[tauri::command]
pub async fn initialize_database(app_handle: AppHandle) -> Result<(), String> {
    let db = Database::new(&app_handle).await.map_err(|e| e.to_string())?;
    
    // Store database in app state
    app_handle.manage(DatabaseState { db: Some(db) });
    
    Ok(())
}

#[tauri::command]
pub async fn get_database_status(state: State<'_, DatabaseState>) -> Result<DatabaseStatus, String> {
    let _db = state.get_db().map_err(|e| e.to_string())?;
    
    // TODO: Implement proper database status checking
    Ok(DatabaseStatus {
        is_initialized: true,
        version: 1,
        last_migration: Some("Initial tables".to_string()),
        has_pending_migrations: false,
    })
}

#[derive(serde::Serialize)]
pub struct DatabaseStatus {
    pub is_initialized: bool,
    pub version: i32,
    pub last_migration: Option<String>,
    pub has_pending_migrations: bool,
}