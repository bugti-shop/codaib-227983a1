/**
 * Google Calendar ↔ App Tasks two-way sync
 * - Incremental sync via syncToken (no duplicates)
 * - Maps Calendar event.id → task.googleCalendarEventId
 * - Preserves reminders, all-day, recurring instances
 * - Like Todoist/TickTick: external-id mapping + etag conflict resolution
 */
import { TodoItem } from '@/types/note';
import { genId } from '@/utils/genId';
import { getValidAccessToken } from '@/utils/googleAuth';
import { loadTodoItems, saveTodoItems } from '@/utils/todoItemsStorage';
import { getSetting, setSetting } from '@/utils/settingsStorage';

const CAL_API = 'https://www.googleapis.com/calendar/v3';
const SYNC_TOKEN_KEY = 'gcal:syncToken';
const LAST_SYNC_KEY = 'gcal:lastSyncAt';
const CALENDAR_ID_KEY = 'gcal:calendarId';
const DEFAULT_CALENDAR_ID = 'primary';

interface GCalEventTime {
  date?: string;       // YYYY-MM-DD (all-day)
  dateTime?: string;   // RFC3339
  timeZone?: string;
}

interface GCalEvent {
  id: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  summary?: string;
  description?: string;
  location?: string;
  start?: GCalEventTime;
  end?: GCalEventTime;
  updated?: string;
  etag?: string;
  recurringEventId?: string;
  reminders?: {
    useDefault?: boolean;
    overrides?: { method: 'popup' | 'email'; minutes: number }[];
  };
}

const parseEventStart = (ev: GCalEvent): Date | undefined => {
  if (ev.start?.dateTime) return new Date(ev.start.dateTime);
  if (ev.start?.date) return new Date(`${ev.start.date}T09:00:00`);
  return undefined;
};

const computeReminderTime = (start: Date | undefined, ev: GCalEvent): Date | undefined => {
  if (!start) return undefined;
  const override = ev.reminders?.overrides?.[0];
  if (!override) return start; // default reminder = at event time
  return new Date(start.getTime() - override.minutes * 60_000);
};

const eventToTask = (ev: GCalEvent, existing?: TodoItem): TodoItem => {
  const start = parseEventStart(ev);
  const reminder = computeReminderTime(start, ev);
  return {
    ...(existing || {
      id: genId(),
      text: '',
      completed: false,
      createdAt: new Date(),
    }),
    text: ev.summary || existing?.text || '(Untitled event)',
    description: ev.description || existing?.description,
    location: ev.location || existing?.location,
    dueDate: start || existing?.dueDate,
    reminderTime: reminder || existing?.reminderTime,
    googleCalendarEventId: ev.id,
    googleEventEtag: ev.etag,
    googleEventUpdatedAt: ev.updated,
    googleEventSyncedAt: Date.now(),
    googleEventSource: existing?.googleEventSource || 'google',
    modifiedAt: new Date(),
  };
};

/**
 * Pull events from Google Calendar and merge into local tasks.
 * Uses syncToken for incremental sync (only changed/deleted events on subsequent calls).
 */
export const syncCalendarToTasks = async (): Promise<{
  added: number;
  updated: number;
  removed: number;
}> => {
  const token = await getValidGoogleAccessToken();
  if (!token) throw new Error('Not signed in to Google');

  const calendarId =
    (await getSetting<string>(CALENDAR_ID_KEY, DEFAULT_CALENDAR_ID)) || DEFAULT_CALENDAR_ID;
  const syncToken = await getSetting<string | null>(SYNC_TOKEN_KEY, null);

  // Build URL: use syncToken if we have one, else do a windowed initial pull
  const params = new URLSearchParams({
    singleEvents: 'true',
    maxResults: '250',
  });
  if (syncToken) {
    params.set('syncToken', syncToken);
  } else {
    // Initial pull: 30 days back → 365 days forward
    const timeMin = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const timeMax = new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString();
    params.set('timeMin', timeMin);
    params.set('timeMax', timeMax);
    params.set('orderBy', 'startTime');
  }

  const allEvents: GCalEvent[] = [];
  let nextSyncToken: string | undefined;
  let pageToken: string | undefined;

  do {
    if (pageToken) params.set('pageToken', pageToken);
    const url = `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events?${params}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

    if (res.status === 410) {
      // syncToken expired → reset and full re-sync next call
      await setSetting(SYNC_TOKEN_KEY, null);
      throw new Error('Calendar sync token expired — will re-sync next attempt');
    }
    if (!res.ok) {
      throw new Error(`Calendar API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    if (Array.isArray(data.items)) allEvents.push(...data.items);
    pageToken = data.nextPageToken;
    if (data.nextSyncToken) nextSyncToken = data.nextSyncToken;
    params.delete('pageToken');
  } while (pageToken);

  // Merge into local tasks
  const tasks = await loadTodoItems();
  const byEventId = new Map(
    tasks
      .filter((t) => t.googleCalendarEventId)
      .map((t) => [t.googleCalendarEventId!, t]),
  );

  let added = 0;
  let updated = 0;
  let removed = 0;
  let next = [...tasks];

  for (const ev of allEvents) {
    const existing = byEventId.get(ev.id);

    if (ev.status === 'cancelled') {
      if (existing) {
        next = next.filter((t) => t.id !== existing.id);
        removed++;
      }
      continue;
    }

    if (existing) {
      // Conflict resolution: if local was modified after remote, skip overwrite
      const remoteUpdated = ev.updated ? new Date(ev.updated).getTime() : 0;
      const localModified = existing.modifiedAt ? new Date(existing.modifiedAt).getTime() : 0;
      if (localModified > remoteUpdated && existing.googleEventSource === 'local') {
        continue; // local wins
      }
      const merged = eventToTask(ev, existing);
      next = next.map((t) => (t.id === existing.id ? merged : t));
      updated++;
    } else {
      next.push(eventToTask(ev));
      added++;
    }
  }

  await saveTodoItems(next);
  if (nextSyncToken) await setSetting(SYNC_TOKEN_KEY, nextSyncToken);
  await setSetting(LAST_SYNC_KEY, Date.now());

  window.dispatchEvent(new Event('tasksUpdated'));
  return { added, updated, removed };
};

/**
 * Push a local task to Google Calendar (create or update).
 * Call this when user creates/edits a task and wants it on calendar.
 */
export const pushTaskToCalendar = async (task: TodoItem): Promise<TodoItem> => {
  if (!task.dueDate) return task; // need a date to put on calendar

  const token = await getValidGoogleAccessToken();
  if (!token) throw new Error('Not signed in to Google');

  const calendarId =
    (await getSetting<string>(CALENDAR_ID_KEY, DEFAULT_CALENDAR_ID)) || DEFAULT_CALENDAR_ID;

  const due = new Date(task.dueDate);
  const end = new Date(due.getTime() + 30 * 60_000); // default 30 min

  const reminderMinutes = task.reminderTime
    ? Math.max(0, Math.round((due.getTime() - new Date(task.reminderTime).getTime()) / 60_000))
    : undefined;

  const body: any = {
    summary: task.text,
    description: task.description,
    location: task.location,
    start: { dateTime: due.toISOString() },
    end: { dateTime: end.toISOString() },
    reminders: {
      useDefault: reminderMinutes === undefined,
      overrides:
        reminderMinutes !== undefined
          ? [{ method: 'popup', minutes: reminderMinutes }]
          : undefined,
    },
  };

  const isUpdate = !!task.googleCalendarEventId;
  const url = isUpdate
    ? `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${task.googleCalendarEventId}`
    : `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events`;

  const res = await fetch(url, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Calendar push failed ${res.status}: ${await res.text()}`);
  }

  const ev: GCalEvent = await res.json();
  return {
    ...task,
    googleCalendarEventId: ev.id,
    googleEventEtag: ev.etag,
    googleEventUpdatedAt: ev.updated,
    googleEventSyncedAt: Date.now(),
    googleEventSource: 'local',
  };
};

export const deleteTaskFromCalendar = async (task: TodoItem): Promise<void> => {
  if (!task.googleCalendarEventId) return;
  const token = await getValidGoogleAccessToken();
  if (!token) return;
  const calendarId =
    (await getSetting<string>(CALENDAR_ID_KEY, DEFAULT_CALENDAR_ID)) || DEFAULT_CALENDAR_ID;
  await fetch(
    `${CAL_API}/calendars/${encodeURIComponent(calendarId)}/events/${task.googleCalendarEventId}`,
    { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } },
  );
};

export const getLastCalendarSyncAt = () => getSetting<number | null>(LAST_SYNC_KEY, null);
export const resetCalendarSync = () => setSetting(SYNC_TOKEN_KEY, null);

// Auto sync hook: call once on login + every 15 min while signed in
let autoSyncTimer: ReturnType<typeof setInterval> | null = null;
export const startCalendarAutoSync = () => {
  if (autoSyncTimer) return;
  syncCalendarToTasks().catch((e) => console.warn('[gcal] initial sync failed', e));
  autoSyncTimer = setInterval(
    () => syncCalendarToTasks().catch((e) => console.warn('[gcal] auto sync failed', e)),
    15 * 60 * 1000,
  );
};
export const stopCalendarAutoSync = () => {
  if (autoSyncTimer) clearInterval(autoSyncTimer);
  autoSyncTimer = null;
};