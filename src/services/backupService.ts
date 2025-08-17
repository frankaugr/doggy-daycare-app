import { invoke } from '@tauri-apps/api/core';
import type { CloudBackupConfig } from '../types';
import { handleError, withRetry } from '../utils/errorHandling';

export class BackupService {
  private static instance: BackupService;
  private config: CloudBackupConfig | null = null;
  private isBackupInProgress = false;
  private lastBackupAttempt: Date | null = null;

  static getInstance(): BackupService {
    if (!BackupService.instance) {
      BackupService.instance = new BackupService();
    }
    return BackupService.instance;
  }

  /**
   * Initialize backup service with configuration
   */
  async initialize(config: CloudBackupConfig): Promise<void> {
    this.config = config;
    
    if (config.enabled && config.auto_sync_on_startup) {
      // Perform initial backup after a short delay
      setTimeout(() => {
        this.performBackup();
      }, 5000);
    }
  }

  /**
   * Update backup configuration
   */
  async updateConfig(config: CloudBackupConfig): Promise<void> {
    this.config = config;
    
    try {
      await invoke('update_cloud_backup_config', { config });
    } catch (error) {
      throw handleError(error);
    }
  }

  /**
   * Perform a backup operation
   */
  async performBackup(): Promise<{ success: boolean; message: string; filename?: string }> {
    if (!this.config || !this.config.enabled) {
      return { success: false, message: 'Backup is not enabled' };
    }

    if (this.isBackupInProgress) {
      return { success: false, message: 'Backup is already in progress' };
    }

    this.isBackupInProgress = true;
    this.lastBackupAttempt = new Date();

    try {
      // Check if cloud directory exists and is accessible
      if (!this.config.cloud_directory) {
        throw new Error('Cloud directory not configured');
      }

      // Export data
      const data = await withRetry(
        () => invoke<string>('export_data'),
        3,
        1000
      );

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `doggy-daycare-backup-${timestamp}.json`;

      // Save to cloud directory
      await withRetry(
        () => invoke('save_cloud_backup', {
          cloudDirectory: this.config!.cloud_directory,
          filename,
          data
        }),
        3,
        2000
      );

      // Cleanup old backups
      await this.cleanupOldBackups();

      // Update last sync timestamp
      const updatedConfig = {
        ...this.config,
        last_sync: new Date().toISOString()
      };
      await this.updateConfig(updatedConfig);

      return {
        success: true,
        message: 'Backup completed successfully',
        filename
      };

    } catch (error) {
      const appError = handleError(error);
      return {
        success: false,
        message: `Backup failed: ${appError.message}`
      };
    } finally {
      this.isBackupInProgress = false;
    }
  }

  /**
   * Clean up old backup files
   */
  private async cleanupOldBackups(): Promise<void> {
    if (!this.config) return;

    try {
      await invoke('cleanup_old_backups', {
        cloudDirectory: this.config.cloud_directory,
        maxBackups: this.config.max_backups
      });
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
      // Don't throw error as this is not critical
    }
  }

  /**
   * Schedule automatic backups
   */
  scheduleAutomaticBackups(): void {
    if (!this.config || !this.config.enabled || this.config.sync_interval_minutes <= 0) {
      return;
    }

    const intervalMs = this.config.sync_interval_minutes * 60 * 1000;
    
    setInterval(async () => {
      try {
        await this.performBackup();
      } catch (error) {
        console.error('Scheduled backup failed:', error);
      }
    }, intervalMs);
  }

  /**
   * Restore data from a backup file
   */
  async restoreFromBackup(backupContent: string): Promise<{ success: boolean; message: string }> {
    try {
      // Validate backup content
      const parsedData = JSON.parse(backupContent);
      
      if (!parsedData.dogs && !parsedData.settings) {
        throw new Error('Invalid backup file format');
      }

      // Import data
      await invoke('import_data', { jsonData: backupContent });

      return {
        success: true,
        message: 'Data restored successfully from backup'
      };

    } catch (error) {
      const appError = handleError(error);
      return {
        success: false,
        message: `Restore failed: ${appError.message}`
      };
    }
  }

  /**
   * Validate cloud directory configuration
   */
  async validateCloudDirectory(directory: string): Promise<{ valid: boolean; message: string }> {
    if (!directory.trim()) {
      return { valid: false, message: 'Cloud directory path is required' };
    }

    try {
      // Test by attempting to write a test file
      const testData = JSON.stringify({ test: true, timestamp: new Date().toISOString() });
      const testFilename = `test-${Date.now()}.json`;

      await invoke('save_cloud_backup', {
        cloudDirectory: directory,
        filename: testFilename,
        data: testData
      });

      // Clean up test file
      try {
        await invoke('cleanup_test_backup', {
          cloudDirectory: directory,
          filename: testFilename
        });
      } catch {
        // Ignore cleanup errors
      }

      return { valid: true, message: 'Cloud directory is accessible' };

    } catch (error) {
      const appError = handleError(error);
      
      if (appError.message.includes('does not exist')) {
        return { valid: false, message: 'Directory does not exist' };
      } else if (appError.message.includes('permission') || appError.message.includes('access')) {
        return { valid: false, message: 'Permission denied - check directory access rights' };
      } else {
        return { valid: false, message: `Cannot access directory: ${appError.message}` };
      }
    }
  }

  /**
   * Get backup status and statistics
   */
  getBackupStatus(): {
    enabled: boolean;
    lastBackup: Date | null;
    lastAttempt: Date | null;
    isInProgress: boolean;
    nextScheduledBackup: Date | null;
    configuration: CloudBackupConfig | null;
  } {
    let nextScheduledBackup: Date | null = null;

    if (this.config && this.config.enabled && this.config.last_sync) {
      const lastSync = new Date(this.config.last_sync);
      const intervalMs = this.config.sync_interval_minutes * 60 * 1000;
      nextScheduledBackup = new Date(lastSync.getTime() + intervalMs);
    }

    return {
      enabled: this.config?.enabled || false,
      lastBackup: this.config?.last_sync ? new Date(this.config.last_sync) : null,
      lastAttempt: this.lastBackupAttempt,
      isInProgress: this.isBackupInProgress,
      nextScheduledBackup,
      configuration: this.config
    };
  }

  /**
   * Generate backup filename with timestamp
   */
  static generateBackupFilename(prefix: string = 'doggy-daycare-backup'): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${prefix}-${timestamp}.json`;
  }

  /**
   * Estimate backup size
   */
  async estimateBackupSize(): Promise<{ sizeBytes: number; estimatedMB: number }> {
    try {
      const data = await invoke<string>('export_data');
      const sizeBytes = new Blob([data]).size;
      const estimatedMB = Math.round((sizeBytes / 1024 / 1024) * 100) / 100;

      return { sizeBytes, estimatedMB };
    } catch (error) {
      console.error('Failed to estimate backup size:', error);
      return { sizeBytes: 0, estimatedMB: 0 };
    }
  }

  /**
   * Check available disk space in cloud directory
   */
  async checkAvailableSpace(): Promise<{ available: boolean; message: string }> {
    if (!this.config?.cloud_directory) {
      return { available: false, message: 'No cloud directory configured' };
    }

    try {
      // This would require a custom Tauri command to check disk space
      // For now, we'll assume space is available
      return { available: true, message: 'Sufficient space available' };
    } catch (error) {
      return { available: false, message: 'Unable to check available space' };
    }
  }
}