// Google Calendar REST API - 서버 프록시 사용
// 직접 Google API 호출 대신 calendar-auth-server를 경유

import { getAuthServerUrl } from './utils/envLoader';

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

// 날짜 유틸리티
function getLocalDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function subtractOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return getLocalDateString(new Date(year, month - 1, day - 1));
}

function addOneDay(dateStr: string): string {
  const [year, month, day] = dateStr.split('-').map(Number);
  return getLocalDateString(new Date(year, month - 1, day + 1));
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
    const start = new Date(event.start.dateTime);
    const end = new Date(event.end.dateTime);
    startDate = getLocalDateString(start);
    endDate = getLocalDateString(end);
    time = start.toTimeString().slice(0, 5);
  } else if (event.start.date && event.end?.date) {
    startDate = event.start.date;
    endDate = subtractOneDay(event.end.date);
    isAllDay = true;
  } else {
    return [];
  }

  // 시작일부터 종료일까지 각 날짜에 이벤트 생성
  let currentDate = startDate;
  while (currentDate <= endDate) {
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

// 앱 이벤트를 Google Calendar API 형식으로 변환
function convertToGoogleEvent(event: GoogleCalendarEvent): GoogleCalendarApiRequest {
  const googleEvent: GoogleCalendarApiRequest = {
    summary: event.title,
    description: event.description,
  };

  if (event.time) {
    const startDateTime = new Date(`${event.date}T${event.time}:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);
    googleEvent.start = { dateTime: startDateTime.toISOString(), timeZone: 'Asia/Seoul' };
    googleEvent.end = { dateTime: endDateTime.toISOString(), timeZone: 'Asia/Seoul' };
  } else {
    googleEvent.start = { date: event.date };
    const nextDay = new Date(event.date);
    nextDay.setDate(nextDay.getDate() + 1);
    googleEvent.end = { date: nextDay.toISOString().split('T')[0] };
  }

  return googleEvent;
}

// 특정 기간의 이벤트 가져오기
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

  const response = await fetch(`${getAuthServerUrl()}/calendar/events?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`API error: ${response.status} ${response.statusText} - ${errorBody}`);
  }

  const data = await response.json() as { items?: GoogleCalendarApiEvent[] };
  return (data.items || []).flatMap(convertGoogleEvent);
}

// 이벤트 생성
export async function createEvent(
  accessToken: string,
  event: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> {
  const response = await fetch(`${getAuthServerUrl()}/calendar/events`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(convertToGoogleEvent(event)),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GoogleCalendarApiEvent;
  const created = convertGoogleEvent(data);
  if (!created.length) throw new Error('Failed to convert created event');
  return created[0];
}

// 이벤트 수정
export async function updateEvent(
  accessToken: string,
  googleEventId: string,
  event: Partial<GoogleCalendarEvent>
): Promise<GoogleCalendarEvent> {
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

  const response = await fetch(`${getAuthServerUrl()}/calendar/events/${googleEventId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error('Google Calendar update error:', response.status, errorBody);
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json() as GoogleCalendarApiEvent;
  const updated = convertGoogleEvent(data);
  if (!updated.length) throw new Error('Failed to convert updated event');
  return updated[0];
}

// 이벤트 삭제
export async function deleteEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  const response = await fetch(`${getAuthServerUrl()}/calendar/events/${googleEventId}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok && response.status !== 204) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }
}
