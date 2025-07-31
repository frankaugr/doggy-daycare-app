import { useState, useEffect } from 'react';
import { Wifi, WifiOff, Cloud, AlertCircle, CheckCircle } from 'lucide-react';
import { cloudBackupService, ConnectionStatus as ConnectionStatusType } from '../services/cloudBackup';

export default function ConnectionStatus() {
  const [status, setStatus] = useState<ConnectionStatusType>(cloudBackupService.getConnectionStatus());
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const unsubscribe = cloudBackupService.subscribe(setStatus);
    return unsubscribe;
  }, []);

  const getStatusIcon = () => {
    if (!status.online) {
      return <WifiOff size={16} className="status-icon offline" />;
    }

    switch (status.syncStatus) {
      case 'syncing':
        return <Cloud size={16} className="status-icon syncing" />;
      case 'success':
        return <CheckCircle size={16} className="status-icon success" />;
      case 'error':
        return <AlertCircle size={16} className="status-icon error" />;
      default:
        return <Wifi size={16} className="status-icon online" />;
    }
  };

  const getStatusText = () => {
    if (!status.online) {
      return 'Offline';
    }

    switch (status.syncStatus) {
      case 'syncing':
        return 'Syncing...';
      case 'success':
        return 'Synced';
      case 'error':
        return 'Sync Error';
      default:
        return 'Online';
    }
  };

  const getStatusClass = () => {
    if (!status.online) return 'connection-status offline';
    
    switch (status.syncStatus) {
      case 'syncing':
        return 'connection-status syncing';
      case 'success':
        return 'connection-status success';
      case 'error':
        return 'connection-status error';
      default:
        return 'connection-status online';
    }
  };

  return (
    <div className="connection-status-container">
      <div 
        className={getStatusClass()}
        onClick={() => setShowDetails(!showDetails)}
        title="Click for details"
      >
        {getStatusIcon()}
        <span className="status-text">{getStatusText()}</span>
      </div>
      
      {showDetails && (
        <div className="connection-details">
          <div className="detail-row">
            <strong>Connection:</strong> {status.online ? 'Online' : 'Offline'}
          </div>
          <div className="detail-row">
            <strong>Last Check:</strong> {status.lastCheck.toLocaleTimeString()}
          </div>
          {status.lastSync && (
            <div className="detail-row">
              <strong>Last Sync:</strong> {cloudBackupService.formatLastSync()}
            </div>
          )}
          {status.syncStatus === 'error' && status.errorMessage && (
            <div className="detail-row error-message">
              <strong>Error:</strong> {status.errorMessage}
            </div>
          )}
          <button 
            className="btn btn-small"
            onClick={(e) => {
              e.stopPropagation();
              cloudBackupService.performAutoSync();
            }}
            disabled={!status.online || status.syncStatus === 'syncing'}
          >
            <Cloud size={14} />
            Manual Sync
          </button>
        </div>
      )}
    </div>
  );
}