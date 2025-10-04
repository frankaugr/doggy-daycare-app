use chrono::{DateTime, Datelike, NaiveDate, Utc};
use directories::ProjectDirs;
use once_cell::sync::Lazy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Mutex;
use tauri_plugin_opener::OpenerExt;
use tempfile::Builder;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DogSchedule {
    pub daycare_days: Vec<u32>,  // Days of week for daycare (0-6, Sunday=0)
    pub training_days: Vec<u32>, // Days of week for training
    pub boarding_days: Vec<u32>, // Days of week for boarding
    pub daycare_drop_off: Option<String>,
    pub daycare_pick_up: Option<String>,
    pub training_drop_off: Option<String>,
    pub training_pick_up: Option<String>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub active: bool,
}

impl Default for DogSchedule {
    fn default() -> Self {
        Self {
            daycare_days: Vec::new(),
            training_days: Vec::new(),
            boarding_days: Vec::new(),
            daycare_drop_off: None,
            daycare_pick_up: None,
            training_drop_off: None,
            training_pick_up: None,
            start_date: None,
            end_date: None,
            active: true,
        }
    }
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dog {
    pub id: String,
    pub name: String,
    pub owner: String,
    pub phone: String,
    pub email: String,
    pub breed: String,
    pub date_of_birth: Option<String>,
    pub vaccine_date: Option<String>,
    pub consent_last_signed: Option<String>,
    pub created_at: DateTime<Utc>,
    #[serde(default)]
    pub schedule: DogSchedule,
    pub household_id: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DailyRecord {
    pub checklist: Option<HashMap<String, bool>>,
    pub feeding_times: Option<String>,
    pub drop_off_time: Option<String>,
    pub pick_up_time: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum ServiceType {
    Daycare,
    Training,
    Boarding,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum AttendanceType {
    #[serde(rename = "not_attending")]
    NotAttending,
    #[serde(rename = "half_day")]
    HalfDay,
    #[serde(rename = "full_day")]
    FullDay,
}

#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
pub enum RecurrencePattern {
    None,
    Daily,
    Weekly,
    BiWeekly,
    Monthly,
    Custom(Vec<u32>), // Days of week (0-6, Sunday=0)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AttendanceEntry {
    pub dog_id: String,
    pub service_type: ServiceType,
    pub attending: bool,
    pub drop_off_time: Option<String>,
    pub pick_up_time: Option<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecurringSchedule {
    pub id: String,
    pub dog_id: String,
    pub service_type: ServiceType,
    pub pattern: RecurrencePattern,
    pub start_date: String,
    pub end_date: Option<String>,
    pub drop_off_time: Option<String>,
    pub pick_up_time: Option<String>,
    pub active: bool,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DayAttendance {
    pub dogs: HashMap<String, bool>, // Keep for backward compatibility
    pub entries: HashMap<String, AttendanceEntry>, // New detailed attendance
    #[serde(default)]
    pub types: HashMap<String, AttendanceType>, // New attendance types for Half-Day support
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
    pub recurring_schedules: Vec<RecurringSchedule>,
    pub settings: Settings,
}

impl Default for AppData {
    fn default() -> Self {
        Self {
            dogs: Vec::new(),
            daily_data: HashMap::new(),
            recurring_schedules: Vec::new(),
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

static DATA_FILE_LOCK: Lazy<Mutex<()>> = Lazy::new(|| Mutex::new(()));

fn is_development_mode() -> bool {
    std::env::var("WSL_DISTRO_NAME").is_ok()
        || std::env::var("CARGO_PKG_NAME").is_ok()
        || std::env::current_dir()
            .map(|dir| dir.to_string_lossy().contains("src-tauri"))
            .unwrap_or(false)
}

fn resolve_app_data_path() -> Result<PathBuf, String> {
    if is_development_mode() {
        let base = if let Ok(current_dir) = std::env::current_dir() {
            if current_dir
                .file_name()
                .map_or(false, |name| name == "src-tauri")
            {
                current_dir.parent().unwrap_or(&current_dir).to_path_buf()
            } else {
                current_dir
            }
        } else {
            let home_dir = std::env::var("HOME")
                .or_else(|_| std::env::var("USERPROFILE"))
                .map_err(|_| "Failed to get home directory".to_string())?;
            PathBuf::from(home_dir)
        };

        let mut dev_path = base;
        dev_path.push("doggy-daycare-dev-data");
        fs::create_dir_all(&dev_path)
            .map_err(|e| format!("Failed to create dev data directory: {}", e))?;
        dev_path.push("data.json");
        Ok(dev_path)
    } else {
        let project_dirs = ProjectDirs::from("com", "DoggyDaycare", "doggy-daycare")
            .ok_or_else(|| "Failed to determine app data directory".to_string())?;
        let data_dir = project_dirs.data_dir();
        fs::create_dir_all(data_dir)
            .map_err(|e| format!("Failed to create app data directory: {}", e))?;
        Ok(data_dir.join("data.json"))
    }
}

fn load_app_data_from_disk(path: &Path) -> Result<AppData, String> {
    if !path.exists() {
        let default_data = AppData::default();
        write_app_data_to_disk(path, &default_data)?;
        return Ok(default_data);
    }

    let content =
        fs::read_to_string(path).map_err(|e| format!("Failed to read data file: {}", e))?;

    if content.trim().is_empty() {
        let default_data = AppData::default();
        write_app_data_to_disk(path, &default_data)?;
        return Ok(default_data);
    }

    match serde_json::from_str::<AppData>(&content) {
        Ok(data) => Ok(data),
        Err(parse_error) => {
            let mut json_data = serde_json::from_str::<serde_json::Value>(&content)
                .map_err(|_| format!("Failed to parse data file: {}", parse_error))?;

            if let Some(settings) = json_data.get_mut("settings") {
                migrate_settings(settings);
            }
            if let Some(dogs) = json_data.get_mut("dogs") {
                migrate_dogs(dogs);
            }
            if json_data.get("recurring_schedules").is_none() {
                json_data["recurring_schedules"] = serde_json::Value::Array(vec![]);
            }
            if let Some(daily_data) = json_data.get_mut("daily_data") {
                migrate_daily_data(daily_data);
            }

            let migrated =
                serde_json::from_value::<AppData>(json_data).map_err(|migration_error| {
                    format!("Failed to migrate data: {}", migration_error)
                })?;

            write_app_data_to_disk(path, &migrated)?;
            Ok(migrated)
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

fn migrate_dogs(dogs: &mut serde_json::Value) {
    println!("Migrating dogs");

    if let Some(dogs_array) = dogs.as_array_mut() {
        for dog in dogs_array {
            // If dog has 'age' field but no 'date_of_birth', remove age field
            // We can't convert age to date_of_birth without knowing the current date
            if dog.get("age").is_some() && !dog.get("date_of_birth").is_some() {
                println!("Removing legacy age field from dog");
                dog.as_object_mut().unwrap().remove("age");
                dog["date_of_birth"] = serde_json::Value::Null;
            }

            // Add schedule field if missing
            if !dog.get("schedule").is_some() {
                println!("Adding schedule field to dog");
                dog["schedule"] = serde_json::json!({
                    "daycare_days": [],
                    "training_days": [],
                    "boarding_days": [],
                    "daycare_drop_off": null,
                    "daycare_pick_up": null,
                    "training_drop_off": null,
                    "training_pick_up": null,
                    "active": true
                });
            }
        }
    }

    println!("Dogs migration completed");
}

fn migrate_daily_data(daily_data: &mut serde_json::Value) {
    println!("Migrating daily attendance data");

    if let Some(days_map) = daily_data.as_object_mut() {
        for (date, day_data) in days_map {
            // First, collect the data we need
            let records_data = day_data.get("records").cloned();
            let dogs_data = day_data
                .get("attendance")
                .and_then(|att| att.get("dogs"))
                .cloned();

            if let Some(attendance) = day_data.get_mut("attendance") {
                // If attendance doesn't have entries field, add it
                if !attendance.get("entries").is_some() {
                    println!("Adding entries field to attendance for date: {}", date);
                    attendance["entries"] = serde_json::json!({});

                    // Migrate existing dogs to entries as daycare services
                    if let Some(dogs_obj) = dogs_data {
                        if let Some(dogs_map) = dogs_obj.as_object() {
                            let mut entries = serde_json::Map::new();

                            for (dog_id, attending) in dogs_map {
                                if attending.as_bool().unwrap_or(false) {
                                    let entry_key = format!("{}_Daycare", dog_id);
                                    let mut entry = serde_json::json!({
                                        "dog_id": dog_id,
                                        "service_type": "Daycare",
                                        "attending": true,
                                        "notes": "Migrated from legacy attendance"
                                    });

                                    // Add times from daily records if available
                                    if let Some(ref records) = records_data {
                                        if let Some(dog_record) = records.get(dog_id) {
                                            if let Some(drop_off) = dog_record.get("drop_off_time")
                                            {
                                                entry["drop_off_time"] = drop_off.clone();
                                            }
                                            if let Some(pick_up) = dog_record.get("pick_up_time") {
                                                entry["pick_up_time"] = pick_up.clone();
                                            }
                                        }
                                    }

                                    entries.insert(entry_key, entry);
                                }
                            }

                            attendance["entries"] = serde_json::Value::Object(entries);
                        }
                    }
                }
            }
        }
    }

    println!("Daily data migration completed");
}

fn generate_schedules_for_dog(data: &mut AppData, dog: &Dog) -> Result<(), String> {
    if !dog.schedule.active {
        return Ok(());
    }

    let today = Utc::now().date_naive().format("%Y-%m-%d").to_string();
    let start_date = dog
        .schedule
        .start_date
        .as_ref()
        .filter(|s| !s.is_empty()) // Filter out empty strings
        .unwrap_or(&today);

    // Generate daycare schedule
    if !dog.schedule.daycare_days.is_empty() {
        let schedule = RecurringSchedule {
            id: Uuid::new_v4().to_string(),
            dog_id: dog.id.clone(),
            service_type: ServiceType::Daycare,
            pattern: RecurrencePattern::Custom(dog.schedule.daycare_days.clone()),
            start_date: start_date.clone(),
            end_date: dog.schedule.end_date.clone(),
            drop_off_time: dog.schedule.daycare_drop_off.clone(),
            pick_up_time: dog.schedule.daycare_pick_up.clone(),
            active: true,
            created_at: Utc::now(),
        };
        data.recurring_schedules.push(schedule);
    }

    // Generate training schedule
    if !dog.schedule.training_days.is_empty() {
        let schedule = RecurringSchedule {
            id: Uuid::new_v4().to_string(),
            dog_id: dog.id.clone(),
            service_type: ServiceType::Training,
            pattern: RecurrencePattern::Custom(dog.schedule.training_days.clone()),
            start_date: start_date.clone(),
            end_date: dog.schedule.end_date.clone(),
            drop_off_time: dog.schedule.training_drop_off.clone(),
            pick_up_time: dog.schedule.training_pick_up.clone(),
            active: true,
            created_at: Utc::now(),
        };
        data.recurring_schedules.push(schedule);
    }

    // Generate boarding schedule
    if !dog.schedule.boarding_days.is_empty() {
        let schedule = RecurringSchedule {
            id: Uuid::new_v4().to_string(),
            dog_id: dog.id.clone(),
            service_type: ServiceType::Boarding,
            pattern: RecurrencePattern::Custom(dog.schedule.boarding_days.clone()),
            start_date: start_date.clone(),
            end_date: dog.schedule.end_date.clone(),
            drop_off_time: None, // Boarding typically doesn't have same-day drop-off/pick-up
            pick_up_time: None,
            active: true,
            created_at: Utc::now(),
        };
        data.recurring_schedules.push(schedule);
    }

    Ok(())
}

fn calculate_age_from_birth_date(date_of_birth: &str) -> Result<String, String> {
    let birth_date = NaiveDate::parse_from_str(date_of_birth, "%Y-%m-%d")
        .map_err(|_| "Invalid date format. Expected YYYY-MM-DD".to_string())?;

    let today = Utc::now().date_naive();
    let age_duration = today.signed_duration_since(birth_date);

    let age_days = age_duration.num_days();

    if age_days < 0 {
        return Ok("Not yet born".to_string());
    }

    let years = age_days / 365;
    let remaining_days = age_days % 365;
    let months = remaining_days / 30;

    if years > 0 {
        if months > 0 {
            Ok(format!(
                "{} year{} {} month{}",
                years,
                if years == 1 { "" } else { "s" },
                months,
                if months == 1 { "" } else { "s" }
            ))
        } else {
            Ok(format!(
                "{} year{}",
                years,
                if years == 1 { "" } else { "s" }
            ))
        }
    } else if months > 0 {
        Ok(format!(
            "{} month{}",
            months,
            if months == 1 { "" } else { "s" }
        ))
    } else {
        Ok(format!(
            "{} day{}",
            age_days,
            if age_days == 1 { "" } else { "s" }
        ))
    }
}

#[tauri::command]
fn calculate_age(date_of_birth: String) -> Result<String, String> {
    calculate_age_from_birth_date(&date_of_birth)
}

#[tauri::command]
fn get_recurring_schedules() -> Result<Vec<RecurringSchedule>, String> {
    with_app_data_read(|data| Ok(data.recurring_schedules.clone()))
}

#[tauri::command]
fn add_recurring_schedule(
    dog_id: String,
    service_type: ServiceType,
    pattern: RecurrencePattern,
    start_date: String,
    end_date: Option<String>,
    drop_off_time: Option<String>,
    pick_up_time: Option<String>,
) -> Result<RecurringSchedule, String> {
    with_app_data_mut(move |data| {
        let schedule = RecurringSchedule {
            id: Uuid::new_v4().to_string(),
            dog_id,
            service_type,
            pattern,
            start_date,
            end_date,
            drop_off_time,
            pick_up_time,
            active: true,
            created_at: Utc::now(),
        };

        data.recurring_schedules.push(schedule.clone());
        Ok(schedule)
    })
}

#[tauri::command]
fn update_recurring_schedule(schedule: RecurringSchedule) -> Result<(), String> {
    with_app_data_mut(move |data| {
        if let Some(index) = data
            .recurring_schedules
            .iter()
            .position(|s| s.id == schedule.id)
        {
            data.recurring_schedules[index] = schedule;
            Ok(())
        } else {
            Err("Schedule not found".to_string())
        }
    })
}

#[tauri::command]
fn delete_recurring_schedule(schedule_id: String) -> Result<(), String> {
    with_app_data_mut(move |data| {
        if let Some(index) = data
            .recurring_schedules
            .iter()
            .position(|s| s.id == schedule_id)
        {
            data.recurring_schedules.remove(index);
            Ok(())
        } else {
            Err("Schedule not found".to_string())
        }
    })
}

#[tauri::command]
fn update_detailed_attendance(
    date: String,
    dog_id: String,
    service_type: ServiceType,
    attending: bool,
    drop_off_time: Option<String>,
    pick_up_time: Option<String>,
    notes: Option<String>,
) -> Result<(), String> {
    with_app_data_mut(move |data| {
        let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
            attendance: DayAttendance {
                dogs: HashMap::new(),
                entries: HashMap::new(),
                types: HashMap::new(),
            },
            records: HashMap::new(),
            am_temp: None,
            pm_temp: None,
        });

        let entry_key = format!("{}_{:?}", dog_id, service_type);

        if service_type == ServiceType::Daycare {
            day_data.attendance.dogs.insert(dog_id.clone(), attending);
        }

        let entry = AttendanceEntry {
            dog_id: dog_id.clone(),
            service_type,
            attending,
            drop_off_time,
            pick_up_time,
            notes,
        };

        day_data.attendance.entries.insert(entry_key, entry);
        Ok(())
    })
}

#[tauri::command]
fn get_attendance_for_date(date: String) -> Result<HashMap<String, AttendanceEntry>, String> {
    with_app_data_read(move |data| {
        if let Some(day_data) = data.daily_data.get(&date) {
            Ok(day_data.attendance.entries.clone())
        } else {
            Ok(HashMap::new())
        }
    })
}

/// Get the weekday as 0-6 where Sunday=0, Monday=1, etc.
/// This is a robust calculation that will never drift over time.
fn get_weekday_index(date: NaiveDate) -> u32 {
    match date.weekday() {
        chrono::Weekday::Sun => 0,
        chrono::Weekday::Mon => 1,
        chrono::Weekday::Tue => 2,
        chrono::Weekday::Wed => 3,
        chrono::Weekday::Thu => 4,
        chrono::Weekday::Fri => 5,
        chrono::Weekday::Sat => 6,
    }
}

/// Check if a date should have attendance based on schedule pattern
fn should_generate_attendance(
    current_date: NaiveDate,
    schedule_start: NaiveDate,
    pattern: &RecurrencePattern,
) -> bool {
    match pattern {
        RecurrencePattern::None => false,
        RecurrencePattern::Daily => true,
        RecurrencePattern::Weekly => {
            // Same weekday as schedule start
            current_date.weekday() == schedule_start.weekday()
        }
        RecurrencePattern::BiWeekly => {
            // Same weekday and exactly 14-day intervals from start
            if current_date.weekday() == schedule_start.weekday() {
                let days_since_start = current_date
                    .signed_duration_since(schedule_start)
                    .num_days();
                days_since_start >= 0 && days_since_start % 14 == 0
            } else {
                false
            }
        }
        RecurrencePattern::Monthly => {
            // Same day of month (with handling for month-end edge cases)
            let start_day = schedule_start.day();
            let current_month_last_day = current_date
                .with_day(1)
                .unwrap()
                .succ_opt()
                .and_then(|d| d.pred_opt())
                .map(|d| d.day())
                .unwrap_or(31);

            // If the target day doesn't exist in current month, use last day of month
            let target_day = std::cmp::min(start_day, current_month_last_day);
            current_date.day() == target_day
        }
        RecurrencePattern::Custom(ref days) => {
            // Check if current weekday is in the specified days
            let current_weekday = get_weekday_index(current_date);
            days.contains(&current_weekday)
        }
    }
}

fn generate_recurring_attendance_internal(
    data: &mut AppData,
    start_date: &str,
    end_date: &str,
) -> Result<(), String> {
    let start = NaiveDate::parse_from_str(start_date, "%Y-%m-%d")
        .map_err(|_| "Invalid start date format".to_string())?;
    let end = NaiveDate::parse_from_str(end_date, "%Y-%m-%d")
        .map_err(|_| "Invalid end date format".to_string())?;

    let mut current_date = start;

    while current_date <= end {
        let date_str = current_date.format("%Y-%m-%d").to_string();

        for schedule in &data.recurring_schedules {
            if !schedule.active {
                continue;
            }

            let schedule_start = NaiveDate::parse_from_str(&schedule.start_date, "%Y-%m-%d")
                .map_err(|e| {
                    println!(
                        "Failed to parse schedule start date '{}': {}",
                        schedule.start_date, e
                    );
                    format!(
                        "Invalid schedule start date '{}': {}",
                        schedule.start_date, e
                    )
                })?;

            if current_date < schedule_start {
                continue;
            }

            if let Some(ref end_date_str) = schedule.end_date {
                if !end_date_str.is_empty() {
                    let schedule_end = NaiveDate::parse_from_str(end_date_str, "%Y-%m-%d")
                        .map_err(|e| {
                            println!(
                                "Failed to parse schedule end date '{}': {}",
                                end_date_str, e
                            );
                            format!("Invalid schedule end date '{}': {}", end_date_str, e)
                        })?;
                    if current_date > schedule_end {
                        continue;
                    }
                }
            }

            // Use robust attendance calculation
            let should_attend =
                should_generate_attendance(current_date, schedule_start, &schedule.pattern);
            println!(
                "Date {}, Dog {}, Service {:?}: should_attend = {}",
                date_str, schedule.dog_id, schedule.service_type, should_attend
            );

            if should_attend {
                let day_data = data
                    .daily_data
                    .entry(date_str.clone())
                    .or_insert_with(|| DayData {
                        attendance: DayAttendance {
                            dogs: HashMap::new(),
                            entries: HashMap::new(),
                            types: HashMap::new(),
                        },
                        records: HashMap::new(),
                        am_temp: None,
                        pm_temp: None,
                    });

                let entry_key = format!("{}_{:?}", schedule.dog_id, schedule.service_type);

                // Only add if not already exists (don't override manual entries)
                if !day_data.attendance.entries.contains_key(&entry_key) {
                    println!(
                        "Creating attendance entry for {} on {}",
                        entry_key, date_str
                    );
                    let entry = AttendanceEntry {
                        dog_id: schedule.dog_id.clone(),
                        service_type: schedule.service_type.clone(),
                        attending: true, // Auto-attend for scheduled dogs
                        drop_off_time: schedule.drop_off_time.clone(),
                        pick_up_time: schedule.pick_up_time.clone(),
                        notes: Some("Auto-scheduled".to_string()),
                    };

                    day_data.attendance.entries.insert(entry_key, entry);

                    // Only update legacy dogs field for Daycare services (for daily checklist sync)
                    if schedule.service_type == ServiceType::Daycare {
                        day_data
                            .attendance
                            .dogs
                            .insert(schedule.dog_id.clone(), true);

                        // Also update daily records with times if provided
                        if schedule.drop_off_time.is_some() || schedule.pick_up_time.is_some() {
                            let current_record = day_data
                                .records
                                .entry(schedule.dog_id.clone())
                                .or_insert_with(|| DailyRecord {
                                    checklist: None,
                                    feeding_times: None,
                                    drop_off_time: None,
                                    pick_up_time: None,
                                    notes: None,
                                });

                            if let Some(ref drop_off) = schedule.drop_off_time {
                                current_record.drop_off_time = Some(drop_off.clone());
                            }
                            if let Some(ref pick_up) = schedule.pick_up_time {
                                current_record.pick_up_time = Some(pick_up.clone());
                            }
                        }
                    }
                }
            }
        }

        current_date = current_date.succ_opt().ok_or("Date overflow")?;
    }

    Ok(())
}

#[tauri::command]
fn generate_recurring_attendance(start_date: String, end_date: String) -> Result<(), String> {
    with_app_data_mut(move |data| {
        generate_recurring_attendance_internal(data, &start_date, &end_date)
    })
}

#[tauri::command]
fn clear_auto_generated_attendance() -> Result<(), String> {
    with_app_data_mut(move |data| {
        for (_date, day_data) in data.daily_data.iter_mut() {
            day_data.attendance.entries.retain(|_, entry| {
                !entry.notes.as_ref().map_or(false, |n| {
                    n.contains("Auto-generated")
                        || n.contains("Scheduled (not confirmed)")
                        || n.contains("Auto-scheduled")
                })
            });
        }
        Ok(())
    })
}

fn write_app_data_to_disk(path: &Path, data: &AppData) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create data directory: {}", e))?;
    }

    let dir = path
        .parent()
        .ok_or_else(|| "Invalid data file path".to_string())?;
    let mut temp_file = Builder::new()
        .prefix("doggy-daycare-")
        .suffix(".json")
        .tempfile_in(dir)
        .map_err(|e| format!("Failed to create temp data file: {}", e))?;

    serde_json::to_writer_pretty(temp_file.as_file_mut(), data)
        .map_err(|e| format!("Failed to serialize data: {}", e))?;
    temp_file
        .as_file_mut()
        .flush()
        .map_err(|e| format!("Failed to flush data file: {}", e))?;
    temp_file
        .as_file_mut()
        .sync_all()
        .map_err(|e| format!("Failed to sync data file: {}", e))?;

    if path.exists() {
        fs::remove_file(path).map_err(|e| format!("Failed to remove old data file: {}", e))?;
    }

    temp_file
        .persist(path)
        .map_err(|e| format!("Failed to persist data file: {}", e.error))?;

    Ok(())
}

fn with_app_data_read<R, F>(reader: F) -> Result<R, String>
where
    F: FnOnce(&AppData) -> Result<R, String>,
{
    let _guard = DATA_FILE_LOCK
        .lock()
        .map_err(|_| "Failed to acquire data lock".to_string())?;
    let path = resolve_app_data_path()?;
    let data = load_app_data_from_disk(&path)?;
    reader(&data)
}

fn with_app_data_mut<R, F>(mutator: F) -> Result<R, String>
where
    F: FnOnce(&mut AppData) -> Result<R, String>,
{
    let _guard = DATA_FILE_LOCK
        .lock()
        .map_err(|_| "Failed to acquire data lock".to_string())?;
    let path = resolve_app_data_path()?;
    let mut data = load_app_data_from_disk(&path)?;
    let result = mutator(&mut data);
    if result.is_ok() {
        write_app_data_to_disk(&path, &data)?;
    }
    result
}

#[tauri::command]
fn get_all_dogs() -> Result<Vec<Dog>, String> {
    with_app_data_read(|data| Ok(data.dogs.clone()))
}

#[allow(non_snake_case)]
#[tauri::command]
fn add_dog(
    name: String,
    owner: String,
    phone: String,
    email: String,
    breed: String,
    dateOfBirth: Option<String>,
    vaccineDate: Option<String>,
    schedule: Option<DogSchedule>,
    householdId: String,
) -> Result<Dog, String> {
    let dog_schedule = schedule.unwrap_or_default();
    let has_schedule = dog_schedule.active
        && (!dog_schedule.daycare_days.is_empty()
            || !dog_schedule.training_days.is_empty()
            || !dog_schedule.boarding_days.is_empty());
    let household = if householdId.is_empty() {
        None
    } else {
        Some(householdId)
    };

    with_app_data_mut(move |data| {
        let dog = Dog {
            id: Uuid::new_v4().to_string(),
            name,
            owner,
            phone,
            email,
            breed,
            date_of_birth: dateOfBirth,
            vaccine_date: vaccineDate,
            consent_last_signed: None,
            created_at: Utc::now(),
            schedule: dog_schedule,
            household_id: household,
        };
        data.dogs.push(dog.clone());

        if has_schedule {
            generate_schedules_for_dog(data, &dog)?;

            let today = Utc::now().date_naive();
            let start_date_for_generation =
                if let Some(ref schedule_start) = dog.schedule.start_date {
                    if schedule_start.is_empty() {
                        today
                    } else {
                        let schedule_start_date =
                            NaiveDate::parse_from_str(schedule_start, "%Y-%m-%d").unwrap_or(today);
                        std::cmp::min(today, schedule_start_date)
                    }
                } else {
                    today
                };

            let end_date_for_generation = if let Some(ref schedule_end) = dog.schedule.end_date {
                if schedule_end.is_empty() {
                    today + chrono::Duration::days(30)
                } else {
                    let schedule_end_date = NaiveDate::parse_from_str(schedule_end, "%Y-%m-%d")
                        .unwrap_or(today + chrono::Duration::days(30));
                    std::cmp::max(today + chrono::Duration::days(30), schedule_end_date)
                }
            } else {
                today + chrono::Duration::days(30)
            };

            let start_str = start_date_for_generation.format("%Y-%m-%d").to_string();
            let end_str = end_date_for_generation.format("%Y-%m-%d").to_string();
            generate_recurring_attendance_internal(data, &start_str, &end_str)?;
        }

        Ok(dog)
    })
}

fn clear_future_attendance_for_dog(data: &mut AppData, dog_id: &str) -> Result<(), String> {
    let today = Utc::now().date_naive();

    // Remove attendance entries for this dog from today onwards
    data.daily_data.retain(|date_str, day_data| {
        if let Ok(date) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
            if date >= today {
                // Remove all attendance entries for this dog
                day_data
                    .attendance
                    .entries
                    .retain(|key, _| !key.starts_with(&format!("{}_", dog_id)));

                // Also remove from legacy attendance format
                day_data.attendance.dogs.remove(dog_id);
            }
        }
        true
    });

    Ok(())
}

#[tauri::command]
fn update_dog(dog: Dog) -> Result<(), String> {
    with_app_data_mut(move |data| {
        if let Some(index) = data.dogs.iter().position(|d| d.id == dog.id) {
            data.recurring_schedules.retain(|s| s.dog_id != dog.id);
            clear_future_attendance_for_dog(data, &dog.id)?;

            data.dogs[index] = dog.clone();
            generate_schedules_for_dog(data, &dog)?;

            let today = Utc::now().date_naive();
            let start_date_for_generation =
                if let Some(ref schedule_start) = dog.schedule.start_date {
                    if schedule_start.is_empty() {
                        today
                    } else {
                        let schedule_start_date =
                            NaiveDate::parse_from_str(schedule_start, "%Y-%m-%d").unwrap_or(today);
                        std::cmp::min(today, schedule_start_date)
                    }
                } else {
                    today
                };

            let end_date_for_generation = if let Some(ref schedule_end) = dog.schedule.end_date {
                if schedule_end.is_empty() {
                    today + chrono::Duration::days(30)
                } else {
                    let schedule_end_date = NaiveDate::parse_from_str(schedule_end, "%Y-%m-%d")
                        .unwrap_or(today + chrono::Duration::days(30));
                    std::cmp::max(today + chrono::Duration::days(30), schedule_end_date)
                }
            } else {
                today + chrono::Duration::days(30)
            };

            let start_str = start_date_for_generation.format("%Y-%m-%d").to_string();
            let end_str = end_date_for_generation.format("%Y-%m-%d").to_string();
            generate_recurring_attendance_internal(data, &start_str, &end_str)?;

            Ok(())
        } else {
            Err("Dog not found".to_string())
        }
    })
}

#[tauri::command]
fn delete_dog(dog_id: String) -> Result<(), String> {
    with_app_data_mut(move |data| {
        if let Some(index) = data.dogs.iter().position(|d| d.id == dog_id) {
            data.dogs.remove(index);
            data.recurring_schedules.retain(|s| s.dog_id != dog_id);
            Ok(())
        } else {
            Err("Dog not found".to_string())
        }
    })
}

#[tauri::command]
fn get_daily_data(date: String) -> Result<Option<DayData>, String> {
    with_app_data_read(move |data| Ok(data.daily_data.get(&date).cloned()))
}

#[tauri::command]
fn update_attendance(date: String, dog_id: String, attending: bool) -> Result<(), String> {
    with_app_data_mut(move |data| {
        let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
            attendance: DayAttendance {
                dogs: HashMap::new(),
                entries: HashMap::new(),
                types: HashMap::new(),
            },
            records: HashMap::new(),
            am_temp: None,
            pm_temp: None,
        });

        day_data.attendance.dogs.insert(dog_id, attending);
        Ok(())
    })
}

#[tauri::command]
fn update_attendance_type(
    date: String,
    dog_id: String,
    attendance_type: AttendanceType,
) -> Result<(), String> {
    with_app_data_mut(move |data| {
        let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
            attendance: DayAttendance {
                dogs: HashMap::new(),
                entries: HashMap::new(),
                types: HashMap::new(),
            },
            records: HashMap::new(),
            am_temp: None,
            pm_temp: None,
        });

        day_data.attendance.types.insert(dog_id, attendance_type);
        Ok(())
    })
}

#[tauri::command]
fn update_daily_record(date: String, dog_id: String, record: DailyRecord) -> Result<(), String> {
    with_app_data_mut(move |data| {
        let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
            attendance: DayAttendance {
                dogs: HashMap::new(),
                entries: HashMap::new(),
                types: HashMap::new(),
            },
            records: HashMap::new(),
            am_temp: None,
            pm_temp: None,
        });

        day_data.records.insert(dog_id, record);
        Ok(())
    })
}

#[tauri::command]
fn update_temperature(
    date: String,
    am_temp: Option<String>,
    pm_temp: Option<String>,
) -> Result<(), String> {
    with_app_data_mut(move |data| {
        let day_data = data.daily_data.entry(date).or_insert_with(|| DayData {
            attendance: DayAttendance {
                dogs: HashMap::new(),
                entries: HashMap::new(),
                types: HashMap::new(),
            },
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

        Ok(())
    })
}

#[tauri::command]
fn get_settings() -> Result<Settings, String> {
    with_app_data_read(|data| Ok(data.settings.clone()))
}

#[tauri::command]
fn update_settings(settings: Settings) -> Result<(), String> {
    with_app_data_mut(move |data| {
        data.settings = settings;
        Ok(())
    })
}

#[tauri::command]
async fn open_email(
    app: tauri::AppHandle,
    to: String,
    subject: String,
    body: String,
) -> Result<(), String> {
    let mailto_url = format!(
        "mailto:{}?subject={}&body={}",
        urlencoding::encode(&to),
        urlencoding::encode(&subject),
        urlencoding::encode(&body)
    );

    if cfg!(debug_assertions) {
        println!("Opening email URL: {}", mailto_url);
    }

    app.opener()
        .open_url(mailto_url, None::<String>)
        .map_err(|e| format!("Failed to open email client: {}", e))?;

    Ok(())
}

#[tauri::command]
fn export_data() -> Result<String, String> {
    with_app_data_read(|data| {
        serde_json::to_string_pretty(data).map_err(|e| format!("Failed to export data: {}", e))
    })
}

#[tauri::command]
fn import_data(json_data: String) -> Result<(), String> {
    let imported: AppData = serde_json::from_str(&json_data)
        .map_err(|e| format!("Failed to parse import data: {}", e))?;

    with_app_data_mut(move |data| {
        *data = imported;
        Ok(())
    })
}

#[tauri::command]
fn get_cloud_backup_config() -> Result<CloudBackupConfig, String> {
    with_app_data_read(|data| Ok(data.settings.cloud_backup.clone().unwrap_or_default()))
}

#[tauri::command]
fn update_cloud_backup_config(config: CloudBackupConfig) -> Result<(), String> {
    with_app_data_mut(move |data| {
        data.settings.cloud_backup = Some(config);
        Ok(())
    })
}

#[tauri::command]
fn save_cloud_backup(
    cloud_directory: String,
    filename: String,
    data: String,
) -> Result<(), String> {
    let cloud_path = PathBuf::from(&cloud_directory);

    if !cloud_path.exists() {
        return Err(format!(
            "Cloud directory does not exist: {}",
            cloud_directory
        ));
    }

    if !cloud_path.is_dir() {
        return Err(format!(
            "Cloud path is not a directory: {}",
            cloud_directory
        ));
    }

    let backup_path = cloud_path.join(&filename);

    fs::write(&backup_path, data)
        .map_err(|e| format!("Failed to write backup to {}: {}", backup_path.display(), e))?;

    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackupFileInfo {
    pub filename: String,
    pub filepath: String,
    pub modified_time: String,
    pub size_bytes: u64,
}

#[tauri::command]
fn list_backup_files(cloud_directory: String) -> Result<Vec<BackupFileInfo>, String> {
    let cloud_path = PathBuf::from(&cloud_directory);

    if !cloud_path.exists() {
        return Err(format!(
            "Cloud directory does not exist: {}",
            cloud_directory
        ));
    }

    if !cloud_path.is_dir() {
        return Err(format!(
            "Cloud path is not a directory: {}",
            cloud_directory
        ));
    }

    let mut backup_files = Vec::new();

    match fs::read_dir(&cloud_path) {
        Ok(entries) => {
            for entry in entries {
                if let Ok(entry) = entry {
                    let path = entry.path();
                    if let Some(filename) = path.file_name() {
                        if let Some(filename_str) = filename.to_str() {
                            if filename_str.starts_with("doggy-daycare-backup-")
                                && filename_str.ends_with(".json")
                            {
                                if let Ok(metadata) = entry.metadata() {
                                    if let Ok(modified) = metadata.modified() {
                                        let datetime: DateTime<Utc> = modified.into();
                                        let file_info = BackupFileInfo {
                                            filename: filename_str.to_string(),
                                            filepath: path.to_string_lossy().to_string(),
                                            modified_time: datetime
                                                .format("%Y-%m-%d %H:%M:%S UTC")
                                                .to_string(),
                                            size_bytes: metadata.len(),
                                        };
                                        backup_files.push(file_info);
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
    backup_files.sort_by(|a, b| b.modified_time.cmp(&a.modified_time));

    Ok(backup_files)
}

#[tauri::command]
fn restore_from_backup(backup_filepath: String) -> Result<(), String> {
    let backup_path = PathBuf::from(&backup_filepath);

    if !backup_path.exists() {
        return Err(format!("Backup file does not exist: {}", backup_filepath));
    }

    // Read backup file content
    let backup_content = fs::read_to_string(&backup_path)
        .map_err(|e| format!("Failed to read backup file: {}", e))?;

    // Parse as AppData to validate
    let backup_data: AppData = serde_json::from_str(&backup_content)
        .map_err(|e| format!("Failed to parse backup file: {}", e))?;

    let _guard = DATA_FILE_LOCK
        .lock()
        .map_err(|_| "Failed to acquire data lock".to_string())?;
    let path = resolve_app_data_path()?;
    write_app_data_to_disk(&path, &backup_data)?;

    if cfg!(debug_assertions) {
        println!(
            "Successfully restored data from backup: {}",
            backup_filepath
        );
    }

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
                            if filename_str.starts_with("doggy-daycare-backup-")
                                && filename_str.ends_with(".json")
                            {
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
                Ok(_) => {
                    if cfg!(debug_assertions) {
                        println!("Removed old backup: {}", file_path.display());
                    }
                }
                Err(e) => {
                    if cfg!(debug_assertions) {
                        println!("Failed to remove old backup {}: {}", file_path.display(), e);
                    }
                }
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
        .invoke_handler(tauri::generate_handler![
            get_all_dogs,
            add_dog,
            update_dog,
            delete_dog,
            get_daily_data,
            update_attendance,
            update_attendance_type,
            update_daily_record,
            update_temperature,
            get_settings,
            update_settings,
            open_email,
            export_data,
            import_data,
            get_cloud_backup_config,
            update_cloud_backup_config,
            save_cloud_backup,
            cleanup_old_backups,
            list_backup_files,
            restore_from_backup,
            calculate_age,
            get_recurring_schedules,
            add_recurring_schedule,
            update_recurring_schedule,
            delete_recurring_schedule,
            update_detailed_attendance,
            get_attendance_for_date,
            generate_recurring_attendance,
            clear_auto_generated_attendance
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
