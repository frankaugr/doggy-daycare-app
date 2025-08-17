use sqlx::{SqlitePool, Row};
use anyhow::{Result, anyhow};
use serde_json;
use std::collections::HashMap;

use super::models::*;
use super::{generate_id, current_timestamp};

pub struct DogRepository {
    pool: SqlitePool,
}

impl DogRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_all(&self) -> Result<Vec<Dog>> {
        let rows = sqlx::query(
            "SELECT * FROM dogs WHERE is_active = 1 ORDER BY name ASC"
        )
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(|row| self.row_to_dog(row))
            .collect::<Result<Vec<_>>>()
    }

    pub async fn find_by_id(&self, id: &str) -> Result<Option<Dog>> {
        let row = sqlx::query(
            "SELECT * FROM dogs WHERE id = ? AND is_active = 1"
        )
        .bind(id)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_dog(row)?)),
            None => Ok(None),
        }
    }

    pub async fn create(&self, input: CreateDogInput) -> Result<Dog> {
        let id = generate_id();
        let created_at = current_timestamp();

        sqlx::query(
            r#"
            INSERT INTO dogs (
                id, name, owner, phone, email, breed, age, vaccine_date,
                emergency_contact, emergency_phone, medical_conditions,
                dietary_restrictions, behavioral_notes, photo_url,
                is_active, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
            "#
        )
        .bind(&id)
        .bind(&input.name)
        .bind(&input.owner)
        .bind(&input.phone)
        .bind(&input.email)
        .bind(&input.breed)
        .bind(&input.age)
        .bind(&input.vaccine_date)
        .bind(&input.emergency_contact)
        .bind(&input.emergency_phone)
        .bind(&input.medical_conditions)
        .bind(&input.dietary_restrictions)
        .bind(&input.behavioral_notes)
        .bind(&input.photo_url)
        .bind(&created_at)
        .execute(&self.pool)
        .await?;

        self.find_by_id(&id).await?.ok_or_else(|| anyhow!("Failed to create dog"))
    }

    pub async fn update(&self, dog: Dog) -> Result<Dog> {
        let updated_at = current_timestamp();

        sqlx::query(
            r#"
            UPDATE dogs SET 
                name = ?, owner = ?, phone = ?, email = ?, breed = ?, age = ?,
                vaccine_date = ?, emergency_contact = ?, emergency_phone = ?,
                medical_conditions = ?, dietary_restrictions = ?, behavioral_notes = ?,
                photo_url = ?, updated_at = ?
            WHERE id = ?
            "#
        )
        .bind(&dog.name)
        .bind(&dog.owner)
        .bind(&dog.phone)
        .bind(&dog.email)
        .bind(&dog.breed)
        .bind(&dog.age)
        .bind(&dog.vaccine_date)
        .bind(&dog.emergency_contact)
        .bind(&dog.emergency_phone)
        .bind(&dog.medical_conditions)
        .bind(&dog.dietary_restrictions)
        .bind(&dog.behavioral_notes)
        .bind(&dog.photo_url)
        .bind(&updated_at)
        .bind(&dog.id)
        .execute(&self.pool)
        .await?;

        self.find_by_id(&dog.id).await?.ok_or_else(|| anyhow!("Dog not found after update"))
    }

    pub async fn delete(&self, id: &str) -> Result<()> {
        let updated_at = current_timestamp();
        
        sqlx::query(
            "UPDATE dogs SET is_active = 0, updated_at = ? WHERE id = ?"
        )
        .bind(&updated_at)
        .bind(id)
        .execute(&self.pool)
        .await?;

        Ok(())
    }

    fn row_to_dog(&self, row: sqlx::sqlite::SqliteRow) -> Result<Dog> {
        Ok(Dog {
            id: row.try_get("id")?,
            name: row.try_get("name")?,
            owner: row.try_get("owner")?,
            phone: row.try_get("phone")?,
            email: row.try_get("email")?,
            breed: row.try_get("breed")?,
            age: row.try_get("age")?,
            vaccine_date: row.try_get("vaccine_date")?,
            consent_last_signed: row.try_get("consent_last_signed")?,
            emergency_contact: row.try_get("emergency_contact")?,
            emergency_phone: row.try_get("emergency_phone")?,
            medical_conditions: row.try_get("medical_conditions")?,
            dietary_restrictions: row.try_get("dietary_restrictions")?,
            behavioral_notes: row.try_get("behavioral_notes")?,
            photo_url: row.try_get("photo_url")?,
            is_active: row.try_get::<i64, _>("is_active")? == 1,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

pub struct DailyRecordRepository {
    pool: SqlitePool,
}

impl DailyRecordRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_by_dog_and_date(&self, dog_id: &str, date: &str) -> Result<Option<DailyRecord>> {
        let row = sqlx::query(
            "SELECT * FROM daily_records WHERE dog_id = ? AND date = ?"
        )
        .bind(dog_id)
        .bind(date)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_daily_record(row)?)),
            None => Ok(None),
        }
    }

    pub async fn find_by_date(&self, date: &str) -> Result<Vec<DailyRecord>> {
        let rows = sqlx::query(
            "SELECT * FROM daily_records WHERE date = ?"
        )
        .bind(date)
        .fetch_all(&self.pool)
        .await?;

        rows.into_iter()
            .map(|row| self.row_to_daily_record(row))
            .collect::<Result<Vec<_>>>()
    }

    pub async fn create_or_update(&self, input: CreateDailyRecordInput) -> Result<DailyRecord> {
        let id = generate_id();
        let created_at = current_timestamp();
        let checklist_json = input.checklist.as_ref()
            .map(|c| serde_json::to_string(c))
            .transpose()?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO daily_records (
                id, dog_id, date, checklist, feeding_times, drop_off_time,
                pick_up_time, notes, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(&input.dog_id)
        .bind(&input.date)
        .bind(&checklist_json)
        .bind(&input.feeding_times)
        .bind(&input.drop_off_time)
        .bind(&input.pick_up_time)
        .bind(&input.notes)
        .bind(&created_at)
        .bind(&created_at)
        .execute(&self.pool)
        .await?;

        self.find_by_dog_and_date(&input.dog_id, &input.date).await?
            .ok_or_else(|| anyhow!("Failed to create daily record"))
    }

    fn row_to_daily_record(&self, row: sqlx::sqlite::SqliteRow) -> Result<DailyRecord> {
        let checklist_str: Option<String> = row.try_get("checklist")?;
        let checklist = checklist_str.as_ref()
            .map(|s| serde_json::from_str::<HashMap<String, bool>>(s))
            .transpose()?;

        Ok(DailyRecord {
            id: row.try_get("id")?,
            dog_id: row.try_get("dog_id")?,
            date: row.try_get("date")?,
            checklist,
            feeding_times: row.try_get("feeding_times")?,
            drop_off_time: row.try_get("drop_off_time")?,
            pick_up_time: row.try_get("pick_up_time")?,
            notes: row.try_get("notes")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

pub struct DayDataRepository {
    pool: SqlitePool,
}

impl DayDataRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn find_by_date(&self, date: &str) -> Result<Option<DayData>> {
        let row = sqlx::query(
            "SELECT * FROM day_data WHERE date = ?"
        )
        .bind(date)
        .fetch_optional(&self.pool)
        .await?;

        match row {
            Some(row) => Ok(Some(self.row_to_day_data(row)?)),
            None => Ok(None),
        }
    }

    pub async fn create_or_update(&self, input: CreateDayDataInput) -> Result<DayData> {
        let id = generate_id();
        let created_at = current_timestamp();
        let attendance_json = serde_json::to_string(&input.attendance)?;

        sqlx::query(
            r#"
            INSERT OR REPLACE INTO day_data (
                id, date, attendance, am_temp, pm_temp, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            "#
        )
        .bind(&id)
        .bind(&input.date)
        .bind(&attendance_json)
        .bind(&input.am_temp)
        .bind(&input.pm_temp)
        .bind(&created_at)
        .bind(&created_at)
        .execute(&self.pool)
        .await?;

        self.find_by_date(&input.date).await?
            .ok_or_else(|| anyhow!("Failed to create day data"))
    }

    fn row_to_day_data(&self, row: sqlx::sqlite::SqliteRow) -> Result<DayData> {
        let attendance_str: String = row.try_get("attendance")?;
        let attendance = serde_json::from_str::<AttendanceData>(&attendance_str)?;

        Ok(DayData {
            id: row.try_get("id")?,
            date: row.try_get("date")?,
            attendance,
            am_temp: row.try_get("am_temp")?,
            pm_temp: row.try_get("pm_temp")?,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}

pub struct SettingsRepository {
    pool: SqlitePool,
}

impl SettingsRepository {
    pub fn new(pool: SqlitePool) -> Self {
        Self { pool }
    }

    pub async fn get(&self) -> Result<Settings> {
        let row = sqlx::query(
            "SELECT * FROM settings WHERE id = 'default'"
        )
        .fetch_one(&self.pool)
        .await?;

        self.row_to_settings(row)
    }

    pub async fn update(&self, settings: Settings) -> Result<Settings> {
        let updated_at = current_timestamp();
        let cloud_backup_json = settings.cloud_backup.as_ref()
            .map(|c| serde_json::to_string(c))
            .transpose()?;
        let email_templates_json = serde_json::to_string(&settings.email_templates)?;
        let email_subjects_json = serde_json::to_string(&settings.email_subjects)?;
        let whatsapp_templates_json = serde_json::to_string(&settings.whatsapp_templates)?;
        let notification_settings_json = settings.notification_settings.as_ref()
            .map(|n| serde_json::to_string(n))
            .transpose()?;

        sqlx::query(
            r#"
            UPDATE settings SET 
                business_name = ?, business_phone = ?, business_email = ?,
                business_address = ?, auto_backup = ?, cloud_backup_config = ?,
                email_templates = ?, email_subjects = ?, whatsapp_templates = ?,
                notification_settings = ?, updated_at = ?
            WHERE id = 'default'
            "#
        )
        .bind(&settings.business_name)
        .bind(&settings.business_phone)
        .bind(&settings.business_email)
        .bind(&settings.business_address)
        .bind(if settings.auto_backup { 1 } else { 0 })
        .bind(&cloud_backup_json)
        .bind(&email_templates_json)
        .bind(&email_subjects_json)
        .bind(&whatsapp_templates_json)
        .bind(&notification_settings_json)
        .bind(&updated_at)
        .execute(&self.pool)
        .await?;

        self.get().await
    }

    fn row_to_settings(&self, row: sqlx::sqlite::SqliteRow) -> Result<Settings> {
        let cloud_backup_str: Option<String> = row.try_get("cloud_backup_config")?;
        let cloud_backup = cloud_backup_str.as_ref()
            .map(|s| serde_json::from_str::<CloudBackupConfig>(s))
            .transpose()?;

        let email_templates_str: String = row.try_get("email_templates")?;
        let email_templates = serde_json::from_str::<EmailTemplates>(&email_templates_str)?;

        let email_subjects_str: String = row.try_get("email_subjects")?;
        let email_subjects = serde_json::from_str::<EmailSubjects>(&email_subjects_str)?;

        let whatsapp_templates_str: String = row.try_get("whatsapp_templates")?;
        let whatsapp_templates = serde_json::from_str::<WhatsAppTemplates>(&whatsapp_templates_str)?;

        let notification_settings_str: Option<String> = row.try_get("notification_settings")?;
        let notification_settings = notification_settings_str.as_ref()
            .map(|s| serde_json::from_str::<NotificationSettings>(s))
            .transpose()?;

        Ok(Settings {
            id: row.try_get("id")?,
            business_name: row.try_get("business_name")?,
            business_phone: row.try_get("business_phone")?,
            business_email: row.try_get("business_email")?,
            business_address: row.try_get("business_address")?,
            auto_backup: row.try_get::<i64, _>("auto_backup")? == 1,
            cloud_backup,
            email_templates,
            email_subjects,
            whatsapp_templates,
            notification_settings,
            created_at: row.try_get("created_at")?,
            updated_at: row.try_get("updated_at")?,
        })
    }
}