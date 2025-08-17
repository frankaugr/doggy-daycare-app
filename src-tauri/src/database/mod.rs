use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use anyhow::{Result, anyhow};
use uuid::Uuid;
use chrono::Utc;
use tauri::{AppHandle, Manager};

pub mod migrations;
pub mod models;
pub mod repositories;

use migrations::run_migrations;

#[derive(Debug, Clone)]
pub struct Database {
    pool: SqlitePool,
}

impl Database {
    pub async fn new(app_handle: &AppHandle) -> Result<Self> {
        let data_dir = app_handle
            .path()
            .app_data_dir()
            .map_err(|e| anyhow!("Failed to get app data directory: {}", e))?;
        
        // Create data directory if it doesn't exist
        tokio::fs::create_dir_all(&data_dir).await
            .map_err(|e| anyhow!("Failed to create data directory: {}", e))?;
        
        let db_path = data_dir.join("doggy_daycare.db");
        let database_url = format!("sqlite:{}", db_path.display());
        
        // Create connection pool
        let pool = SqlitePoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
            .await
            .map_err(|e| anyhow!("Failed to connect to database: {}", e))?;
        
        let database = Database { pool };
        
        // Run migrations
        database.initialize().await?;
        
        Ok(database)
    }
    
    pub async fn initialize(&self) -> Result<()> {
        run_migrations(&self.pool).await
    }
    
    pub fn pool(&self) -> &SqlitePool {
        &self.pool
    }
    
    pub async fn begin_transaction(&self) -> Result<sqlx::Transaction<'_, sqlx::Sqlite>> {
        self.pool.begin().await
            .map_err(|e| anyhow!("Failed to begin transaction: {}", e))
    }
}

// Utility functions for database operations
pub fn generate_id() -> String {
    Uuid::new_v4().to_string()
}

pub fn current_timestamp() -> String {
    Utc::now().to_rfc3339()
}

// Database connection state for Tauri
#[derive(Default)]
pub struct DatabaseState {
    pub db: Option<Database>,
}

impl DatabaseState {
    pub fn get_db(&self) -> Result<&Database> {
        self.db.as_ref().ok_or_else(|| anyhow!("Database not initialized"))
    }
}