import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { MemoryService } from '../memory/MemoryService';
import { Collector } from '../types';

export class CalendarReadCollector implements Collector {
  private interval: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(private memoryService: MemoryService) {}

  async start() {
    if (this.isRunning) return;
    this.isRunning = true;
    
    // Check every 15 minutes
    this.interval = setInterval(async () => {
      const tokenPath = path.join(process.cwd(), 'google_token.json');
      if (!fs.existsSync(tokenPath)) return;

      try {
        const credentials = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'google_credentials.json'), 'utf-8'));
        const tokens = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
        const { client_secret, client_id } = credentials.installed;
        const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, 'http://localhost');
        oAuth2Client.setCredentials(tokens);
        
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
          // Store the next upcoming event
          const nextEvent = events[0];
          await this.memoryService.storeEvent({
            type: 'CALENDAR_EVENT',
            app: nextEvent.summary || 'Busy',
            content: nextEvent.description || '',
            timestamp: nextEvent.start.dateTime ? new Date(nextEvent.start.dateTime) : new Date()
          });
        }
      } catch (error) {
        // Silent fail
      }
    }, 900000); 
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
    this.isRunning = false;
  }
}