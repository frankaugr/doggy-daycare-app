use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use tauri_plugin_opener::OpenerExt;


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
pub struct Settings {
    pub business_name: String,
    pub auto_backup: bool,
    pub email_templates: EmailTemplate,
    pub email_subjects: EmailSubject,
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
                auto_backup: true,
                email_templates: EmailTemplate {
                    consent_form: "Dear {ownerName},\n\nThis is a friendly reminder that your dog {dogName} needs their monthly consent form completed for continued daycare services.\n\nPlease complete and return the consent form at your earliest convenience. If you have any questions or concerns, please don't hesitate to contact us.\n\nThank you for choosing our daycare services for {dogName}.\n\nBest regards,\nThe Doggy Daycare Team\n\nDate: {currentDate}".to_string(),
                    vaccine_reminder: "Dear {ownerName},\n\nThis is a friendly reminder that your dog {dogName}'s {vaccineType} vaccination is due to expire on {expirationDate}.\n\nTo ensure {dogName} can continue to enjoy our daycare services, please schedule an appointment with your veterinarian to update their vaccination records.\n\nPlease provide us with the updated vaccination certificate once completed.\n\nThank you for keeping {dogName} healthy and safe.\n\nBest regards,\nThe Doggy Daycare Team".to_string(),
                },
                email_subjects: EmailSubject {
                    consent_form: "Monthly Consent Form Required - {dogName}".to_string(),
                    vaccine_reminder: "Vaccine Record Update Required - {dogName}".to_string(),
                },
            },
        }
    }
}

fn get_app_data_path() -> Result<PathBuf, String> {
    let home_dir = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map_err(|_| "Failed to get home directory")?;
    let mut path = PathBuf::from(home_dir);
    
    // Use a more cross-platform approach
    #[cfg(target_os = "windows")]
    path.push("AppData\\Roaming\\doggy-daycare");
    
    #[cfg(not(target_os = "windows"))]
    path.push(".local/share/doggy-daycare");
    
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
    serde_json::from_str(&content)
        .map_err(|e| {
            println!("Failed to parse data file: {}", e);
            format!("Failed to parse data file: {}", e)
        })
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            get_all_dogs,
            add_dog,
            update_dog,
            delete_dog,
            get_daily_data,
            update_attendance,
            update_daily_record,
            update_temperature,
            get_settings,
            update_settings,
            open_email,
            export_data,
            import_data
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}