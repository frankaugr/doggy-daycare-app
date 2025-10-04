import { invoke } from '@tauri-apps/api/core';

export interface CloudBackupConfig {
  enabled: boolean;
  cloud_directory: string;
  max_backups: number;
  sync_interval_minutes: number;
}

export interface ConnectionStatus {
  online: boolean;
  lastCheck: Date;
  lastSync?: Date;
  syncStatus: 'idle' | 'syncing' | 'success' | 'error';
  errorMessage?: string;
}

class CloudBackupService {
  private connectionStatus: ConnectionStatus = {
    online: false,
    lastCheck: new Date(),
    syncStatus: 'idle'
  };
  
  private listeners: ((status: ConnectionStatus) => void)[] = [];
  private checkInterval?: number;
  private syncInterval?: number;

  constructor() {
    this.startConnectivityMonitoring().catch(console.error);
  }

  public getConnectionStatus(): ConnectionStatus {
    return { ...this.connectionStatus };
  }

  public subscribe(callback: (status: ConnectionStatus) => void): () => void {
    this.listeners.push(callback);
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  private notifyListeners() {
    this.listeners.forEach(listener => listener(this.getConnectionStatus()));
  }

  private async checkInternetConnection(): Promise<boolean> {
    try {
      await fetch('https://www.google.com/generate_204', {
        method: 'HEAD',
        mode: 'no-cors',
        cache: 'no-cache'
      });
      return true;
    } catch {
      try {
        await fetch('https://httpbin.org/status/200', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache'
        });
        return true;
      } catch {
        return false;
      }
    }
  }

  private async startConnectivityMonitoring() {
    await this.checkConnectivity();
    
    // Initialize sync interval and perform initial sync if enabled
    const config = await this.getCloudBackupConfig();
    if (config.enabled) {
      // Set up periodic sync interval
      if (config.sync_interval_minutes > 0) {
        this.syncInterval = window.setInterval(() => {
          this.performAutoSync();
        }, config.sync_interval_minutes * 60 * 1000);
      }
      
      // If we're online and have a cloud directory, perform initial sync
      if (this.connectionStatus.online && config.cloud_directory) {
        setTimeout(() => {
          this.performAutoSync();
        }, 2000); // Wait 2 seconds after startup to let the app fully load
      }
    }
    
    this.checkInterval = window.setInterval(() => {
      this.checkConnectivity();
    }, 30000);
  }

  public stopConnectivityMonitoring() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = undefined;
    }
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }
  }

  private async checkConnectivity() {
    const wasOnline = this.connectionStatus.online;
    this.connectionStatus.online = await this.checkInternetConnection();
    this.connectionStatus.lastCheck = new Date();

    if (!wasOnline && this.connectionStatus.online) {
      await this.performAutoSync();
    }

    this.notifyListeners();
  }

  public async performAutoSync(): Promise<void> {
    if (!this.connectionStatus.online) {
      if (import.meta.env.DEV) {
        console.log('Cannot sync: offline');
      }
      return;
    }

    this.connectionStatus.syncStatus = 'syncing';
    this.notifyListeners();

    try {
      const config = await this.getCloudBackupConfig();
      if (!config.enabled || !config.cloud_directory) {
        this.connectionStatus.syncStatus = 'idle';
        this.notifyListeners();
        return;
      }

      const backupData = await invoke<string>('export_data');
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `doggy-daycare-backup-${timestamp}.json`;
      
      await this.saveToCloudDirectory(config.cloud_directory, filename, backupData);
      await this.cleanupOldBackups(config.cloud_directory, config.max_backups);

      this.connectionStatus.syncStatus = 'success';
      this.connectionStatus.lastSync = new Date();
      this.connectionStatus.errorMessage = undefined;
    } catch (error) {
      console.error('Auto sync failed:', error);
      this.connectionStatus.syncStatus = 'error';
      this.connectionStatus.errorMessage = error instanceof Error ? error.message : 'Unknown error';
    }

    this.notifyListeners();
  }

  private async saveToCloudDirectory(cloudDir: string, filename: string, data: string): Promise<void> {
    try {
      await invoke('save_cloud_backup', {
        cloudDirectory: cloudDir,
        filename: filename,
        data: data
      });
    } catch (error) {
      throw new Error(`Failed to save backup to cloud directory: ${error}`);
    }
  }

  private async cleanupOldBackups(cloudDir: string, maxBackups: number): Promise<void> {
    try {
      await invoke('cleanup_old_backups', {
        cloudDirectory: cloudDir,
        maxBackups: maxBackups
      });
    } catch (error) {
      console.warn('Failed to cleanup old backups:', error);
    }
  }

  public async getCloudBackupConfig(): Promise<CloudBackupConfig> {
    try {
      const config = await invoke<CloudBackupConfig>('get_cloud_backup_config');
      return config;
    } catch (error) {
      return {
        enabled: false,
        cloud_directory: '',
        max_backups: 100,
        sync_interval_minutes: 30
      };
    }
  }

  public async updateCloudBackupConfig(config: CloudBackupConfig): Promise<void> {
    await invoke('update_cloud_backup_config', { config });
    
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = undefined;
    }

    if (config.enabled && config.sync_interval_minutes > 0) {
      this.syncInterval = window.setInterval(() => {
        this.performAutoSync();
      }, config.sync_interval_minutes * 60 * 1000);
    }
  }

  public formatLastSync(): string {
    if (!this.connectionStatus.lastSync) {
      return 'Never';
    }

    const now = new Date();
    const lastSync = this.connectionStatus.lastSync;
    const diffMs = now.getTime() - lastSync.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 1) {
      return 'Just now';
    } else if (diffMinutes < 60) {
      return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
    } else if (diffHours < 24) {
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    } else {
      return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;
    }
  }
}

export const cloudBackupService = new CloudBackupService();
