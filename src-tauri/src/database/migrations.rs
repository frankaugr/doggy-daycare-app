use sqlx::SqlitePool;
use anyhow::Result;

pub async fn run_migrations(pool: &SqlitePool) -> Result<()> {
    // Create migrations table if it doesn't exist
    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            version INTEGER UNIQUE NOT NULL,
            description TEXT NOT NULL,
            executed_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
        "#,
    )
    .execute(pool)
    .await?;

    // Get current version
    let current_version: i64 = sqlx::query_scalar(
        "SELECT COALESCE(MAX(version), 0) FROM migrations"
    )
    .fetch_one(pool)
    .await?;

    // Define migrations
    let migrations = get_migrations();
    
    // Run pending migrations
    for migration in migrations {
        if migration.version > current_version {
            println!("Running migration {}: {}", migration.version, migration.description);
            
            // Execute migration
            sqlx::query(&migration.up)
                .execute(pool)
                .await?;
            
            // Record migration
            sqlx::query(
                "INSERT INTO migrations (version, description) VALUES (?, ?)"
            )
            .bind(migration.version)
            .bind(&migration.description)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}

struct Migration {
    version: i64,
    description: String,
    up: String,
    #[allow(dead_code)]
    down: String,
}

fn get_migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "Create initial tables".to_string(),
            up: r#"
                -- Dogs table
                CREATE TABLE dogs (
                    id TEXT PRIMARY KEY,
                    name TEXT NOT NULL,
                    owner TEXT NOT NULL,
                    phone TEXT NOT NULL,
                    email TEXT NOT NULL,
                    breed TEXT NOT NULL,
                    age TEXT NOT NULL,
                    vaccine_date TEXT,
                    consent_last_signed TEXT,
                    emergency_contact TEXT,
                    emergency_phone TEXT,
                    medical_conditions TEXT,
                    dietary_restrictions TEXT,
                    behavioral_notes TEXT,
                    photo_url TEXT,
                    is_active INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT
                );

                -- Daily records table
                CREATE TABLE daily_records (
                    id TEXT PRIMARY KEY,
                    dog_id TEXT NOT NULL,
                    date TEXT NOT NULL,
                    checklist TEXT, -- JSON
                    feeding_times TEXT,
                    drop_off_time TEXT,
                    pick_up_time TEXT,
                    notes TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT,
                    FOREIGN KEY (dog_id) REFERENCES dogs(id) ON DELETE CASCADE,
                    UNIQUE(dog_id, date)
                );

                -- Day data table
                CREATE TABLE day_data (
                    id TEXT PRIMARY KEY,
                    date TEXT UNIQUE NOT NULL,
                    attendance TEXT NOT NULL, -- JSON
                    am_temp TEXT,
                    pm_temp TEXT,
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT
                );

                -- Settings table
                CREATE TABLE settings (
                    id TEXT PRIMARY KEY,
                    business_name TEXT NOT NULL,
                    business_phone TEXT NOT NULL,
                    business_email TEXT,
                    business_address TEXT,
                    auto_backup INTEGER NOT NULL DEFAULT 0,
                    cloud_backup_config TEXT, -- JSON
                    email_templates TEXT, -- JSON
                    email_subjects TEXT, -- JSON
                    whatsapp_templates TEXT, -- JSON
                    notification_settings TEXT, -- JSON
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    updated_at TEXT
                );

                -- Sync operations table for offline support
                CREATE TABLE sync_operations (
                    id TEXT PRIMARY KEY,
                    operation_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE
                    entity_type TEXT NOT NULL, -- dog, daily_record, day_data, settings
                    entity_data TEXT NOT NULL, -- JSON
                    created_at TEXT NOT NULL DEFAULT (datetime('now')),
                    retries INTEGER NOT NULL DEFAULT 0,
                    max_retries INTEGER NOT NULL DEFAULT 3,
                    last_attempt TEXT,
                    status TEXT NOT NULL DEFAULT 'pending' -- pending, processing, completed, failed
                );

                -- Create indexes for better performance
                CREATE INDEX idx_dogs_active ON dogs(is_active);
                CREATE INDEX idx_dogs_owner ON dogs(owner);
                CREATE INDEX idx_daily_records_date ON daily_records(date);
                CREATE INDEX idx_daily_records_dog_date ON daily_records(dog_id, date);
                CREATE INDEX idx_day_data_date ON day_data(date);
                CREATE INDEX idx_sync_operations_status ON sync_operations(status);
                CREATE INDEX idx_sync_operations_entity ON sync_operations(entity_type);

                -- Insert default settings
                INSERT INTO settings (
                    id, 
                    business_name, 
                    business_phone,
                    email_templates,
                    email_subjects,
                    whatsapp_templates,
                    cloud_backup_config,
                    notification_settings
                ) VALUES (
                    'default',
                    'Your Doggy Daycare',
                    '',
                    '{"consent_form": "Dear {ownerName},\n\nThis is a reminder that {dogName}''s monthly consent form needs to be renewed.\n\nPlease bring the signed form during your next visit.\n\nThank you!", "vaccine_reminder": "Dear {ownerName},\n\n{dogName}''s {vaccineType} vaccination expires on {expirationDate}.\n\nPlease schedule an appointment with your veterinarian.\n\nThank you!"}',
                    '{"consent_form": "Monthly Consent Form Renewal Required", "vaccine_reminder": "Vaccination Reminder for {dogName}"}',
                    '{"consent_form": "Hi {ownerName}, this is a reminder that {dogName}''s monthly consent form needs renewal. Please bring it during your next visit. Thanks!", "vaccine_reminder": "Hi {ownerName}, {dogName}''s {vaccineType} vaccination expires on {expirationDate}. Please schedule a vet appointment. Thanks!"}',
                    '{"enabled": false, "cloud_directory": "", "max_backups": 100, "sync_interval_minutes": 30, "auto_sync_on_startup": true}',
                    '{"email_enabled": true, "whatsapp_enabled": true, "desktop_notifications": true, "reminder_advance_days": 7}'
                );
            "#.to_string(),
            down: r#"
                DROP TABLE IF EXISTS sync_operations;
                DROP TABLE IF EXISTS settings;
                DROP TABLE IF EXISTS day_data;
                DROP TABLE IF EXISTS daily_records;
                DROP TABLE IF EXISTS dogs;
            "#.to_string(),
        },
    ]
}