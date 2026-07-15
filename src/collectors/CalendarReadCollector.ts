import { google } from 'googleapis';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';
import { getGoogleAuthClient, googleTokenExists } from '../auth/googleClient';
import { warnThrottled } from '../utils/logger';

export class CalendarReadCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private memoryService: MemoryService) {}

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Check every 15 minutes
    this.interval = setInterval(async () => {
      if (!googleTokenExists()) return;

      try {
        const oAuth2Client = getGoogleAuthClient();
        const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
        const res = await calendar.events.list({
          calendarId: 'primary',
          timeMin: new Date().toISOString(),
          maxResults: 3,
          singleEvents: true,
          orderBy: 'startTime',
        });

        const events = res.data.items;
        if (events && events.length > 0) {
          // Store the next upcoming event. All-day events use start.date, timed
          // events use start.dateTime — guard both (start itself can be absent).
          const nextEvent = events[0];
          const startStr = nextEvent.start?.dateTime || nextEvent.start?.date;
          await this.memoryService.storeEvent({
            type: 'CALENDAR_EVENT',
            app: nextEvent.summary || 'Busy',
            content: nextEvent.description || '',
            timestamp: startStr ? new Date(startStr) : new Date()
          });
        }
      } catch (error) {
        warnThrottled('calendar-collector', 300000, '[CalendarReadCollector] poll failed:', error instanceof Error ? error.message : error);
      }
    }, 900000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}