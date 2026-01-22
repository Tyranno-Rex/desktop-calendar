// Google Calendar REST API 직접 호출 (googleapis 라이브러리 없이)

const CALENDAR_API_BASE = 'https://www.googleapis.com/calendar/v3';

export interface GoogleCalendarEvent {
  id: string;
  title: string;
  date: string;
  time?: string;
  description?: string;
  googleEventId?: string;
}

// Google Calendar API 이벤트를 앱 이벤트로 변환
function convertGoogleEvent(event: any): GoogleCalendarEvent | null {
  if (!event.start) return null;

  let date: string;
  let time: string | undefined;

  if (event.start.dateTime) {
    const startDate = new Date(event.start.dateTime);
    date = startDate.toISOString().split('T')[0];
    time = startDate.toTimeString().slice(0, 5);
  } else if (event.start.date) {
    date = event.start.date;
  } else {
    return null;
  }

  return {
    id: `google_${event.id}`,
    title: event.summary || '(No title)',
    date,
    time,
    description: event.description,
    googleEventId: event.id,
  };
}

// 앱 이벤트를 Google Calendar API 형식으로 변환
function convertToGoogleEvent(event: GoogleCalendarEvent): any {
  const googleEvent: any = {
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
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '500',
  });

  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events?${params}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json() as any;
    const events = data.items || [];

    return events
      .map(convertGoogleEvent)
      .filter((e: GoogleCalendarEvent | null): e is GoogleCalendarEvent => e !== null);
  } catch (error) {
    console.error('Failed to get Google Calendar events:', error);
    throw error;
  }
}

// 이벤트 생성
export async function createEvent(
  accessToken: string,
  event: GoogleCalendarEvent
): Promise<GoogleCalendarEvent> {
  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events`,
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

    const data = await response.json();
    const created = convertGoogleEvent(data);

    if (!created) throw new Error('Failed to convert created event');
    return created;
  } catch (error) {
    console.error('Failed to create Google Calendar event:', error);
    throw error;
  }
}

// 이벤트 수정
export async function updateEvent(
  accessToken: string,
  googleEventId: string,
  event: Partial<GoogleCalendarEvent>
): Promise<GoogleCalendarEvent> {
  try {
    const updateData: any = {};

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
      `${CALENDAR_API_BASE}/calendars/primary/events/${googleEventId}`,
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
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const updated = convertGoogleEvent(data);

    if (!updated) throw new Error('Failed to convert updated event');
    return updated;
  } catch (error) {
    console.error('Failed to update Google Calendar event:', error);
    throw error;
  }
}

// 이벤트 삭제
export async function deleteEvent(
  accessToken: string,
  googleEventId: string
): Promise<void> {
  try {
    const response = await fetch(
      `${CALENDAR_API_BASE}/calendars/primary/events/${googleEventId}`,
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
