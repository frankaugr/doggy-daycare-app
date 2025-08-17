import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppContext } from '../contexts/AppContext';
import type { SyncOperation, UseOfflineSyncReturn } from '../types';

export function useOfflineSync(): UseOfflineSyncReturn {
  const { state, dispatch } = useAppContext();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [issyncing, setIsSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Monitor online/offline status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      // Auto-process queue when coming back online
      if (state.syncQueue.length > 0) {
        processQueue();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [state.syncQueue.length]);

  // Load pending sync operations from database on mount
  useEffect(() => {
    loadPendingSyncOperations();
  }, []);

  const loadPendingSyncOperations = async () => {
    try {
      // TODO: Implement command to get pending sync operations
      // const operations = await invoke<SyncOperation[]>('get_pending_sync_operations');
      // operations.forEach(op => {
      //   dispatch({ type: 'ADD_SYNC_OPERATION', payload: op });
      // });
    } catch (_error) {
      console.error('Failed to load pending sync operations:', _error);
    }
  };

  const addToQueue = useCallback((operation: SyncOperation) => {
    // Add to local queue immediately
    dispatch({ type: 'ADD_SYNC_OPERATION', payload: operation });

    // Persist to database for offline support
    persistSyncOperation(operation);

    // If online, try to process immediately
    if (isOnline) {
      processQueue();
    }
  }, [isOnline, dispatch]);

  const persistSyncOperation = async (_operation: SyncOperation) => {
    try {
      // TODO: Implement command to persist sync operation
      // await invoke('add_sync_operation', { operation });
    } catch (error) {
      console.error('Failed to persist sync operation:', error);
    }
  };

  const processQueue = useCallback(async () => {
    if (!isOnline || issyncing || state.syncQueue.length === 0) {
      return;
    }

    setIsSyncing(true);
    const operations = [...state.syncQueue];

    for (const operation of operations) {
      try {
        await processSyncOperation(operation);
        dispatch({ type: 'REMOVE_SYNC_OPERATION', payload: operation.id });
        
        // Remove from database
        await removeSyncOperation(operation.id);
      } catch (error) {
        console.error('Failed to process sync operation:', error);
        
        // Increment retry count
        const updatedOperation: SyncOperation = {
          ...operation,
          retries: operation.retries + 1,
          timestamp: new Date()
        };

        // If max retries reached, remove from queue
        if (updatedOperation.retries >= updatedOperation.max_retries) {
          dispatch({ type: 'REMOVE_SYNC_OPERATION', payload: operation.id });
          await removeSyncOperation(operation.id);
        } else {
          // Update operation in queue
          dispatch({ type: 'REMOVE_SYNC_OPERATION', payload: operation.id });
          dispatch({ type: 'ADD_SYNC_OPERATION', payload: updatedOperation });
        }
      }
    }

    setLastSync(new Date());
    setIsSyncing(false);
  }, [isOnline, issyncing, state.syncQueue, dispatch]);

  const processSyncOperation = async (operation: SyncOperation): Promise<void> => {
    const { operation: op, entity, data } = operation;

    switch (entity) {
      case 'dog':
        switch (op) {
          case 'CREATE':
            await invoke('add_dog', data);
            break;
          case 'UPDATE':
            await invoke('update_dog', { dog: data });
            break;
          case 'DELETE':
            await invoke('delete_dog', { dogId: data.id });
            break;
        }
        break;

      case 'daily_record':
        switch (op) {
          case 'CREATE':
          case 'UPDATE':
            await invoke('save_daily_record', {
              dogId: data.dog_id,
              date: data.date,
              record: data
            });
            break;
        }
        break;

      case 'day_data':
        switch (op) {
          case 'CREATE':
          case 'UPDATE':
            await invoke('save_day_data', {
              date: data.date,
              dayData: data
            });
            break;
        }
        break;

      case 'settings':
        switch (op) {
          case 'UPDATE':
            await invoke('update_settings', { settings: data });
            break;
        }
        break;

      default:
        throw new Error(`Unknown entity type: ${entity}`);
    }
  };

  const removeSyncOperation = async (_operationId: string) => {
    try {
      // TODO: Implement command to remove sync operation
      // await invoke('remove_sync_operation', { operationId });
    } catch (error) {
      console.error('Failed to remove sync operation:', error);
    }
  };

  const clearQueue = useCallback(() => {
    dispatch({ type: 'CLEAR_SYNC_QUEUE' });
    // TODO: Clear from database as well
  }, [dispatch]);

  // Auto-sync interval when online
  useEffect(() => {
    if (!isOnline) return;

    const interval = setInterval(() => {
      if (state.syncQueue.length > 0) {
        processQueue();
      }
    }, 30000); // Try to sync every 30 seconds

    return () => clearInterval(interval);
  }, [isOnline, state.syncQueue.length, processQueue]);

  return {
    isOnline,
    syncQueue: state.syncQueue,
    queueSize: state.syncQueue.length,
    issyncing,
    lastSync,
    addToQueue,
    processQueue,
    clearQueue,
  };
}