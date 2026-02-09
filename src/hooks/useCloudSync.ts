import { useState, useCallback, useRef, useEffect } from 'react';
import pako from 'pako';
import type { CalendarEvent, Memo, Settings, SyncState } from '../types';
import { useAuth } from '../contexts/AuthContext';

// API 서버 URL
const API_BASE_URL = 'http://localhost:3001';

// 동기화 간격 (5분)
const SYNC_INTERVAL = 5 * 60 * 1000;

// 클라이언트 Rate Limit (초당 5회 허용)
const CLIENT_RATE_LIMIT_MAX_REQUESTS = 5;
const CLIENT_RATE_LIMIT_WINDOW_MS = 1000; // 1초 윈도우

// Rate limit 추적 (모듈 레벨)
const requestTimestamps: number[] = [];

function checkClientRateLimit(): { allowed: boolean; message?: string } {
  const now = Date.now();
  // 윈도우 밖의 타임스탬프 제거
  while (requestTimestamps.length > 0 && requestTimestamps[0] < now - CLIENT_RATE_LIMIT_WINDOW_MS) {
    requestTimestamps.shift();
  }
  // 안전장치: 배열 크기 제한 (메모리 누수 방지)
  if (requestTimestamps.length > 100) {
    requestTimestamps.splice(0, requestTimestamps.length - 10);
  }
  // 요청 수 체크
  if (requestTimestamps.length >= CLIENT_RATE_LIMIT_MAX_REQUESTS) {
    return { allowed: false, message: 'Too many requests. Please slow down.' };
  }
  // 현재 요청 추가
  requestTimestamps.push(now);
  return { allowed: true };
}

// 로컬 스토리지 키
const LAST_SYNC_KEY = 'cloud_last_sync_at';
const PENDING_CHANGES_KEY = 'cloud_pending_changes';

interface SyncResult {
  success: boolean;
  error?: string;
  retryAfterMs?: number;  // 429 에러 시 재시도 대기 시간
  clientRateLimited?: boolean;  // 클라이언트 rate limit에 걸림 (원복 필요)
}

interface FetchResult {
  success: boolean;
  events?: CalendarEvent[];
  memos?: Memo[];
  settings?: Settings;
  error?: string;
}

// 변경된 항목만 추출하는 헬퍼
interface PendingChanges {
  events: Set<string>;  // 변경된 이벤트 ID
  memos: Set<string>;   // 변경된 메모 ID
  settings: boolean;    // 설정 변경 여부
}

function loadPendingChanges(): PendingChanges {
  try {
    const saved = localStorage.getItem(PENDING_CHANGES_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        events: new Set(parsed.events || []),
        memos: new Set(parsed.memos || []),
        settings: parsed.settings || false,
      };
    }
  } catch (e) {
    console.error('[useCloudSync] Failed to load pending changes:', e);
  }
  return { events: new Set(), memos: new Set(), settings: false };
}

function savePendingChanges(changes: PendingChanges): void {
  try {
    localStorage.setItem(PENDING_CHANGES_KEY, JSON.stringify({
      events: Array.from(changes.events),
      memos: Array.from(changes.memos),
      settings: changes.settings,
    }));
  } catch (e) {
    console.error('[useCloudSync] Failed to save pending changes:', e);
  }
}

function clearPendingChanges(): void {
  localStorage.removeItem(PENDING_CHANGES_KEY);
}

// 동기화용 이벤트 타입 (deleted 플래그 포함 가능)
type SyncableEvent = CalendarEvent & { deleted?: boolean };

interface UseCloudSyncReturn extends SyncState {
  syncEvents: (events: SyncableEvent[]) => Promise<SyncResult>;
  syncMemos: (memos: Memo[]) => Promise<SyncResult>;
  syncSettings: (settings: Settings) => Promise<SyncResult>;
  syncAll: (data: { events: SyncableEvent[]; memos: Memo[]; settings: Settings }) => Promise<SyncResult>;
  fetchFromCloud: () => Promise<FetchResult>;
  fetchSyncStatus: () => Promise<void>;
  startAutoSync: () => void;
  stopAutoSync: () => void;
  // Delta Sync: 변경 추적 함수
  markEventChanged: (eventId: string) => void;
  markMemoChanged: (memoId: string) => void;
  markSettingsChanged: () => void;
}

export function useCloudSync(): UseCloudSyncReturn {
  const { sessionToken, isAuthenticated, user } = useAuth();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(() => {
    // 로컬 스토리지에서 마지막 동기화 시간 복원
    return localStorage.getItem(LAST_SYNC_KEY);
  });
  const [syncError, setSyncError] = useState<string | null>(null);
  const [pendingChanges, setPendingChanges] = useState(0);
  const autoSyncRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingChangesRef = useRef<PendingChanges>(loadPendingChanges());

  // Premium 사용자인지 확인 (클라이언트 측 UI 표시용)
  // 실제 동기화 권한은 서버에서 검증하므로, 여기서는 단순 체크만 수행
  // 시간 변조 공격 방지를 위해 서버 응답에 의존
  const isPremium = user?.subscriptionTier === 'premium';

  // lastSyncAt 저장
  const updateLastSyncAt = useCallback((timestamp: string) => {
    setLastSyncAt(timestamp);
    localStorage.setItem(LAST_SYNC_KEY, timestamp);
  }, []);

  // 변경 추적: 이벤트 변경 시 호출
  const markEventChanged = useCallback((eventId: string) => {
    pendingChangesRef.current.events.add(eventId);
    savePendingChanges(pendingChangesRef.current);
    setPendingChanges(pendingChangesRef.current.events.size + pendingChangesRef.current.memos.size);
  }, []);

  // 변경 추적: 메모 변경 시 호출
  const markMemoChanged = useCallback((memoId: string) => {
    pendingChangesRef.current.memos.add(memoId);
    savePendingChanges(pendingChangesRef.current);
    setPendingChanges(pendingChangesRef.current.events.size + pendingChangesRef.current.memos.size);
  }, []);

  // 변경 추적: 설정 변경 시 호출
  const markSettingsChanged = useCallback(() => {
    pendingChangesRef.current.settings = true;
    savePendingChanges(pendingChangesRef.current);
    setPendingChanges(prev => prev + 1);
  }, []);

  // 동기화 성공 후 변경 추적 초기화
  const clearChanges = useCallback(() => {
    pendingChangesRef.current = { events: new Set(), memos: new Set(), settings: false };
    clearPendingChanges();
    setPendingChanges(0);
  }, []);

  // API 요청 헬퍼 (429 에러 처리 + gzip 압축 + 타임아웃)
  const apiRequest = useCallback(async (
    endpoint: string,
    method: 'GET' | 'POST' | 'PATCH' = 'GET',
    body?: unknown,
    timeoutMs = 30000  // 기본 30초 타임아웃
  ): Promise<{ data?: unknown; rateLimited?: boolean; retryAfterMs?: number }> => {
    if (!sessionToken) {
      throw new Error('Not authenticated');
    }

    // POST/PATCH 요청 시 gzip 압축
    let requestBody: BodyInit | undefined;
    const headers: Record<string, string> = {
      'Authorization': `Bearer ${sessionToken}`,
    };

    if (body && (method === 'POST' || method === 'PATCH')) {
      const jsonString = JSON.stringify(body);
      const compressed = pako.gzip(jsonString);
      requestBody = compressed;
      headers['Content-Type'] = 'application/json';
      headers['Content-Encoding'] = 'gzip';
    }

    // AbortController로 타임아웃 구현
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        headers,
        body: requestBody,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // 429 Rate Limit 처리
      if (response.status === 429) {
        const errorData = await response.json().catch(() => ({}));
        // 에러 메시지에서 초 추출: "Rate limit exceeded. Try again in Xs"
        const match = errorData.error?.match(/in (\d+)s/);
        const retryAfterMs = match ? parseInt(match[1], 10) * 1000 : 10000;
        return { rateLimited: true, retryAfterMs };
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Request failed: ${response.status}`);
      }

      return { data: await response.json() };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }, [sessionToken]);

  // 동기화 상태 조회
  const fetchSyncStatus = useCallback(async () => {
    if (!isAuthenticated || !isPremium) return;

    try {
      const result = await apiRequest('/sync/status');
      if (result.data) {
        const data = result.data as { lastSyncAt?: string; pendingChanges?: number };
        if (data.lastSyncAt) updateLastSyncAt(data.lastSyncAt);
      }
    } catch (error) {
      console.error('[useCloudSync] Failed to fetch sync status:', error);
    }
  }, [isAuthenticated, isPremium, apiRequest, updateLastSyncAt]);

  // 이벤트 동기화 (Delta: 변경된 이벤트만)
  const syncEvents = useCallback(async (events: SyncableEvent[]): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Delta Sync: 변경된 이벤트만 필터링
      const changedIds = pendingChangesRef.current.events;
      const eventsToSync = changedIds.size > 0
        ? events.filter(e => changedIds.has(e.id))
        : events;  // 변경 추적이 없으면 전체 (초기 동기화)

      const result = await apiRequest('/sync/events', 'POST', {
        events: eventsToSync,
        last_sync_at: lastSyncAt,
      });

      if (result.rateLimited) {
        setSyncError(`Rate limited. Retry in ${Math.ceil((result.retryAfterMs || 10000) / 1000)}s`);
        return { success: false, error: 'Rate limited', retryAfterMs: result.retryAfterMs };
      }

      const timestamp = new Date().toISOString();
      updateLastSyncAt(timestamp);
      pendingChangesRef.current.events.clear();
      savePendingChanges(pendingChangesRef.current);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest, lastSyncAt, updateLastSyncAt]);

  // 메모 동기화 (Delta: 변경된 메모만)
  const syncMemos = useCallback(async (memos: Memo[]): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // Delta Sync: 변경된 메모만 필터링
      const changedIds = pendingChangesRef.current.memos;
      const memosToSync = changedIds.size > 0
        ? memos.filter(m => changedIds.has(m.id))
        : memos;  // 변경 추적이 없으면 전체 (초기 동기화)

      const result = await apiRequest('/sync/memos', 'POST', {
        memos: memosToSync,
        last_sync_at: lastSyncAt,
      });

      if (result.rateLimited) {
        setSyncError(`Rate limited. Retry in ${Math.ceil((result.retryAfterMs || 10000) / 1000)}s`);
        return { success: false, error: 'Rate limited', retryAfterMs: result.retryAfterMs };
      }

      const timestamp = new Date().toISOString();
      updateLastSyncAt(timestamp);
      pendingChangesRef.current.memos.clear();
      savePendingChanges(pendingChangesRef.current);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest, lastSyncAt, updateLastSyncAt]);

  // 설정 동기화
  const syncSettings = useCallback(async (settings: Settings): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      const result = await apiRequest('/sync/settings', 'POST', { settings });

      if (result.rateLimited) {
        setSyncError(`Rate limited. Retry in ${Math.ceil((result.retryAfterMs || 10000) / 1000)}s`);
        return { success: false, error: 'Rate limited', retryAfterMs: result.retryAfterMs };
      }

      const timestamp = new Date().toISOString();
      updateLastSyncAt(timestamp);
      pendingChangesRef.current.settings = false;
      savePendingChanges(pendingChangesRef.current);
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest, updateLastSyncAt]);

  // 전체 동기화 (Delta Sync: 변경된 항목만 전송)
  const syncAll = useCallback(async (data: {
    events: SyncableEvent[];
    memos: Memo[];
    settings: Settings;
  }): Promise<SyncResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    // 클라이언트 Rate Limit 체크
    const rateLimitCheck = checkClientRateLimit();
    if (!rateLimitCheck.allowed) {
      setSyncError(rateLimitCheck.message || 'Too many requests');
      return {
        success: false,
        error: rateLimitCheck.message,
        clientRateLimited: true,  // 클라이언트에서 막힘 - 원복 필요
      };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // 전체 동기화: 항상 모든 데이터 전송
      // (Delta Sync는 markEventChanged 연동 후 활성화)
      const eventsToSync = data.events;
      const memosToSync = data.memos;
      const settingsToSync = data.settings;

      console.log('[useCloudSync] Full Sync:', {
        events: eventsToSync.length,
        memos: memosToSync.length,
        settings: settingsToSync ? 'yes' : 'no',
      });

      const result = await apiRequest('/sync/all', 'POST', {
        events: eventsToSync,
        memos: memosToSync,
        settings: settingsToSync,
        last_sync_at: lastSyncAt,
      });

      if (result.rateLimited) {
        const retryAfterSec = Math.ceil((result.retryAfterMs || 10000) / 1000);
        setSyncError(`Rate limited. Retry in ${retryAfterSec}s`);
        return { success: false, error: 'Rate limited', retryAfterMs: result.retryAfterMs };
      }

      const timestamp = new Date().toISOString();
      updateLastSyncAt(timestamp);
      clearChanges();
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Sync failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest, lastSyncAt, updateLastSyncAt, clearChanges]);

  // 서버에서 데이터 가져오기 (앱 시작 시 사용, last_sync_at 이후 변경분만)
  const fetchFromCloud = useCallback(async (): Promise<FetchResult> => {
    if (!isAuthenticated || !isPremium) {
      return { success: false, error: 'Premium subscription required' };
    }

    setIsSyncing(true);
    setSyncError(null);

    try {
      // last_sync_at 이후 변경된 데이터만 요청
      const result = await apiRequest('/sync/all', 'POST', {
        events: [],
        memos: [],
        settings: null,
        last_sync_at: lastSyncAt,  // Delta fetch
      });

      if (result.rateLimited) {
        const retryAfterSec = Math.ceil((result.retryAfterMs || 10000) / 1000);
        setSyncError(`Rate limited. Retry in ${retryAfterSec}s`);
        return { success: false, error: 'Rate limited' };
      }

      const data = result.data as {
        events?: CalendarEvent[];
        memos?: Memo[];
        settings?: Settings;
        synced_at?: string;
      };

      const timestamp = data.synced_at || new Date().toISOString();
      updateLastSyncAt(timestamp);

      return {
        success: true,
        events: data.events || [],
        memos: data.memos || [],
        settings: data.settings || undefined,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Fetch failed';
      setSyncError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsSyncing(false);
    }
  }, [isAuthenticated, isPremium, apiRequest, lastSyncAt, updateLastSyncAt]);

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
    fetchFromCloud,
    fetchSyncStatus,
    startAutoSync,
    stopAutoSync,
    // Delta Sync: 변경 추적 함수
    markEventChanged,
    markMemoChanged,
    markSettingsChanged,
  };
}
