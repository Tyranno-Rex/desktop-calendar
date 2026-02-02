// Google Calendar REST API - 서버 프록시 사용
// 직접 Google API 호출 대신 calendar-auth-server를 경유

import fs from 'fs';
import path from 'path';

// 환경 변수 캐시
let envCache: Record<string, string> | null = null;

// .env 파일 로드 및 캐싱
function getEnvVars(): Record<string, string> {
  if (envCache) return envCache;

  envCache = {};

  const possiblePaths = [
    path.join(process.cwd(), 'env', '.env'),
    path.join(__dirname, '..', 'env', '.env'),
    path.join(__dirname, '..', '..', 'env', '.env'),
  ];

  const resourcesPath = (process as NodeJS.Process & { resourcesPath?: string }).resourcesPath;
  if (resourcesPath) {
    possiblePaths.push(
      path.join(resourcesPath, 'app.asar', 'env', '.env'),
      path.join(resourcesPath, 'app', 'env', '.env')
    );
  }

  for (const envPath of possiblePaths) {
    if (fs.existsSync(envPath)) {
      try {
        const content = fs.readFileSync(envPath, 'utf-8');
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#')) {
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
              const key = trimmed.substring(0, eqIndex).trim();
              const value = trimmed.substring(eqIndex + 1).trim();
              envCache[key] = value;
            }
          }
        }
        break;
      } catch {
        // 파일 읽기 실패시 다음 경로 시도
      }
    }
  }

  return envCache;
}

// 환경 변수 가져오기
function getEnv(key: string, defaultValue = ''): string {
  return process.env[key] || getEnvVars()[key] || defaultValue;
}

// Auth 서버 URL
function getAuthServerUrl(): string {
  return getEnv('AUTH_SERVER_URL', 'http://localhost:3001');
}

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  googleEventId?: string;
}

// Google Calendar API 응답 타입
interface GoogleCalendarApiEvent {
  id: string;
  summary?: string;
  description?: string;
  start?: {
    date?: string;
    dateTime?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
  };
}

// 로컬 날짜 문자열을 yyyy-MM-dd 형식으로 변환 (타임존 문제 방지)
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// yyyy-MM-dd 문자열에서 하루를 빼기 (타임존 문제 방지)
function subtractOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day - 1); // month는 0-indexed
  return getLocalDateString(date);
}

// yyyy-MM-dd 문자열에 하루를 더하기 (타임존 문제 방지)
function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  const date = new Date(year, month - 1, day + 1);
  return getLocalDateString(date);
}

// yyyy-MM-dd 문자열 비교 (a <= b)
function dateStrLessOrEqual(a: string, b: string): boolean {
  return a <= b; // 문자열 비교로 충분 (yyyy-MM-dd 형식)
}

// Google Calendar API 이벤트를 앱 이벤트로 변환 (멀티데이 이벤트는 여러 개로 분리)
function convertGoogleEvent(event: GoogleCalendarApiEvent): GoogleCalendarEvent[] {
  if (!event.start) return [];

  const results: GoogleCalendarEvent[] = [];
  let startDate: string;
  let endDate: string;
  let time: string | undefined;
  let isAllDay = false;

  if (event.start.dateTime && event.end?.dateTime) {
    // 시간이 지정된 이벤트
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    startDate = getLocalDateString(start);
    endDate = getLocalDateString(end);
    time = start.toTimeString().slice(0, 5);
  } else if (event.start.date && event.end?.date) {
    // 종일 이벤트 (날짜 문자열 그대로 사용)
    startDate = event.start.date; // "2026-01-29"
    // Google Calendar의 종일 이벤트는 end.date가 다음날로 설정됨 (exclusive)
    // 예: 1/29-1/31 이벤트는 end.date가 "2026-02-01"
    endDate = subtractOneDay(event.end.date); // "2026-01-31"
    isAllDay = true;
  } else {
    return [];
  }

  // 시작일부터 종료일까지 각 날짜에 이벤트 생성
  let currentDate = startDate;

  while (dateStrLessOrEqual(currentDate, endDate)) {
    const isFirstDay = currentDate === startDate;

    results.push({
      id: `google_${event.id}_${currentDate}`,
      title: event.summary || '(No title)',
      date: currentDate,
      time: isFirstDay && !isAllDay ? time : undefined,
      description: event.description,
      googleEventId: event.id,
    });

    currentDate = addOneDay(currentDate);
  }

  return results;
}

// Google Calendar API 요청 형식
interface GoogleCalendarApiRequest {
  summary?: string;
  description?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
}

// 앱 이벤트를 Google Calendar API 형식으로 변환
function convertToGoogleEvent(event: GoogleCalendarEvent): GoogleCalendarApiRequest {
  const googleEvent: GoogleCalendarApiRequest = {
    summary: event.title,
    description: event.description,
  };

  if (event.time) {
    const startDateTime = new Date(`${event.date}T${event.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    googleEvent.start = {
      dateTime: startDateTime.toISOString(),
      timeZone: 'Asia/Seoul',
    };
    googleEvent.end = {
      dateTime: endDateTime.toISOString(),
      timeZone: 'Asia/Seoul',
    };
  } else {
    googleEvent.start = { date: event.date };
    const nextDay = new Date(event.date);
    nextDay.setDate(nextDay.getDate() + 1);
    googleEvent.end = { date: nextDay.toISOString().split('T')[0] };
  }

  return googleEvent;
}

// 특정 기간의 이벤트 가져오기 (서버 프록시 경유)
export async function getEvents(
  accessToken: string,
  timeMin?: Date,
  timeMax?: Date
): Promise<GoogleCalendarEvent[]> {
  const now = new Date();
  const defaultTimeMin = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const defaultTimeMax = new Date(now.getFullYear(), now.getMonth() + 2, 0);

  const params = new URLSearchParams({
    timeMin: (timeMin || defaultTimeMin).toISOString(),
    timeMax: (timeMax || defaultTimeMax).toISOString(),
    maxResults: '500',
  });

  try {
    const response = await fetch(
      `${getAuthServerUrl()}/calendar/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API error: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json() as { items?: GoogleCalendarApiEvent[] };
    const events = data.items || [];

    // 멀티데이 이벤트가 분리되어 반환되므로 flat() 사용
    return events.flatMap(convertGoogleEvent);
  } catch (error) {
    console.error('Failed to get Google Calendar events:', error);
    throw error;
  }
}

// 이벤트 생성 (서버 프록시 경유)
export async function createEvent(
  accessToken: string,
  event: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> {
  try {
    const response = await fetch(
      `${getAuthServerUrl()}/calendar/events`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(convertToGoogleEvent(event)),
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GoogleCalendarApiEvent;
    const created = convertGoogleEvent(data);

    if (!created || created.length === 0) throw new Error('Failed to convert created event');
    return created[0]; // 생성된 이벤트는 단일 이벤트이므로 첫 번째 요소 반환
  } catch (error) {
    console.error('Failed to create Google Calendar event:', error);
    throw error;
  }
}

// 이벤트 수정 (서버 프록시 경유)
export async function updateEvent(
  accessToken: string,
  googleEventId: string,
  event: Partial<GoogleCalendarEvent>
): Promise<GoogleCalendarEvent> {
  try {
    const updateData: GoogleCalendarApiRequest = {};

    if (event.title) updateData.summary = event.title;
    if (event.description !== undefined) updateData.description = event.description;

    if (event.date) {
      if (event.time) {
        const startDateTime = new Date(`${event.date}T${event.time}:00`);
        const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
        updateData.start = { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Seoul' };
        updateData.end = { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Seoul' };
      } else {
        updateData.start = { date: event.date };
        const nextDay = new Date(event.date);
        nextDay.setDate(nextDay.getDate() + 1);
        updateData.end = { date: nextDay.toISOString().split('T')[0] };
      }
    }

    const response = await fetch(
      `${getAuthServerUrl()}/calendar/events/${googleEventId}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      console.error('Google Calendar update error:', response.status, errorBody);
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as GoogleCalendarApiEvent;
    const updated = convertGoogleEvent(data);

    if (!updated || updated.length === 0) throw new Error('Failed to convert updated event');
    return updated[0]; // 수정된 이벤트는 단일 이벤트이므로 첫 번째 요소 반환
  } catch (error) {
    console.error('Failed to update Google Calendar event:', error);
    throw error;
  }
}

// 이벤트 삭제 (서버 프록시 경유)
export async function deleteEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  try {
    const response = await fetch(
      `${getAuthServerUrl()}/calendar/events/${googleEventId}`,
      {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok && response.status !== 204) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    console.error('Failed to delete Google Calendar event:', error);
    throw error;
  }
}
