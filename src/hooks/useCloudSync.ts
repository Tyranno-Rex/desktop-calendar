import { useState, useCallback, useRef, useEffect } from 'react';
import type { CalendarEvent, Memo, Settings, SyncState } from '../types';
import { useAuth } from '../contexts/AuthContext';

// API 서버 URL
const API_BASE_URL = 'http://localhost:3001';

// 동기화 간격 (5분)
const SYNC_INTERVAL = 5 * 60 * 1000;

interface SyncResult {
  success: boolean;
  error?: string;
}

interface UseCloudSyncReturn extends SyncState {
  syncEvents: (events: CalendarEvent[]) => Promise<SyncResult>;
  syncMemos: (memos: Memo[]) => Promise<SyncResult>;
  syncSettings: (settings: Settings) => Promise<SyncResult>;
  syncAll: (data: { events: CalendarEvent[]; memos: Memo[]; settings: Settings }) => Promise<SyncResult>;
  fetchSyncStatus: () => Promise<void>;
  startAutoSync: () => void;
  stopAutoSync: () => void;
}

export function useCloudSync(): UseCloudSyncReturn {
  const { sessionToken, isAuthenticated, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Premium 사용자인지 확인
  const isPremium = user?.subscriptionTier === 'premium';

  // API 요청 헬퍼
  const apiRequest = useCallback(async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    body?: unknown
  ) => {
    if (!sessionToken) {
      throw new Error('Not authenticated');
    }

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Request failed: ${response.status}`);
    }

    return response.json();
  }, [sessionToken]);

  // 동기화 상태 조회
  const fetchSyncStatus = useCallback(async () => {
    if (!isAuthenticated || !isPremium) return;

    try {
      const data = await apiRequest('/sync/status');
      setLastSyncAt(data.lastSyncAt);
      setPendingChanges(data.pendingChanges || 0);
    } catch (error) {
      console.error('[useCloudSync] Failed to fetch sync status:', error);
    }
  }, [isAuthenticated, isPremium, apiRequest]);

  // 이벤트 동기화
  const syncEvents = useCallback(async (events: CalendarEvent[]): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await apiRequest('/sync/events', 'POST', { events });
      setLastSyncAt(new Date().toISOString());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest]);

  // 메모 동기화
  const syncMemos = useCallback(async (memos: Memo[]): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await apiRequest('/sync/memos', 'POST', { memos });
      setLastSyncAt(new Date().toISOString());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest]);

  // 설정 동기화
  const syncSettings = useCallback(async (settings: Settings): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await apiRequest('/sync/settings', 'POST', { settings });
      setLastSyncAt(new Date().toISOString());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest]);

  // 전체 동기화
  const syncAll = useCallback(async (data: {
    events: CalendarEvent[];
    memos: Memo[];
    settings: Settings;
  }): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      await apiRequest('/sync/all', 'POST', data);
      setLastSyncAt(new Date().toISOString());
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest]);

  // 자동 동기화 시작
  const startAutoSync = useCallback(() => {
    if (!isAuthenticated || !isPremium) return;

    // 이미 실행 중이면 중지
    if (autoSyncRef.current) {
      clearInterval(autoSyncRef.current);
    }

    // 초기 동기화 상태 조회
    fetchSyncStatus();

    // 주기적으로 동기화 상태 조회
    autoSyncRef.current = setInterval(() => {
      fetchSyncStatus();
    }, SYNC_INTERVAL);
  }, [isAuthenticated, isPremium, fetchSyncStatus]);

  // 자동 동기화 중지
  const stopAutoSync = useCallback(() => {
    if (autoSyncRef.current) {
      clearInterval(autoSyncRef.current);
      autoSyncRef.current = null;
    }
  }, []);

  // 컴포넌트 언마운트 시 자동 동기화 중지
  useEffect(() => {
    return () => {
      if (autoSyncRef.current) {
        clearInterval(autoSyncRef.current);
      }
    };
  }, []);

  return {
    isSyncing,
    lastSyncAt,
    syncError,
    pendingChanges,
    syncEvents,
    syncMemos,
    syncSettings,
    syncAll,
    fetchSyncStatus,
    startAutoSync,
    stopAutoSync,
  };
}
