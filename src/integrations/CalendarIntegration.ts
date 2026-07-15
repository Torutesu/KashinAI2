// src/integrations/CalendarIntegration.ts
import { google } from 'googleapis';
import { getGoogleAuthClient } from '../auth/googleClient';

export class CalendarIntegration {
  private async getAuth() {
    // Shared, refresh-capable client (auto-refreshes + persists the token).
    return getGoogleAuthClient();
  }

  // 1. Create Event (Existing)
  async createEvent(summary: string, startTime: string, endTime: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const calendar = google.calendar({ version: 'v3', auth });
      const event = {
        summary,
        start: { dateTime: startTime },
        end: { dateTime: endTime },
      };
      const response = await calendar.events.insert({ calendarId: 'primary', requestBody: event });
      return `Successfully created calendar event: ${response.data.summary} (ID: ${response.data.id})`;
    } catch (error) {
      return `Error creating calendar event: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 2. Read Upcoming Events
  // 2. Read Upcoming Events
  async readUpcomingEvents(): Promise<string> {
    try {
      const auth = await this.getAuth();
      const calendar = google.calendar({ version: 'v3', auth });

      const res = await calendar.events.list({
        calendarId: 'primary',
        timeMin: new Date().toISOString(),
        maxResults: 5,
        singleEvents: true,
        orderBy: 'startTime',
      });

      const events = res.data.items;
      if (!events || events.length === 0) return `You have no upcoming events.`;

      let result = `Here are your next 5 events:\n`;
      for (const event of events) {
        const start = event.start?.dateTime || event.start?.date || 'Unknown time';
        const summary = event.summary || '(No title)';
        const id = event.id || 'unknown';
        result += `- ID: ${id} | ${start} | ${summary}\n`;
      }
      return result;
    } catch (error) {
      return `Error reading events: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 3. Update Event Time
  async updateEventTime(eventId: string, startTime: string, endTime: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const calendar = google.calendar({ version: 'v3', auth });

      const updatedEvent = {
        start: { dateTime: startTime },
        end: { dateTime: endTime },
      };

      const response = await calendar.events.patch({
        calendarId: 'primary',
        eventId: eventId,
        requestBody: updatedEvent,
      });

      return `Successfully updated event ${response.data.summary} (ID: ${eventId}). New time: ${startTime} to ${endTime}`;
    } catch (error) {
      return `Error updating event: ${error instanceof Error ? error.message : String(error)}`;
    }
  }

  // 4. Delete Event
  async deleteEvent(eventId: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const calendar = google.calendar({ version: 'v3', auth });

      await calendar.events.delete({
        calendarId: 'primary',
        eventId: eventId,
      });

      return `Successfully deleted event with ID: ${eventId}`;
    } catch (error) {
      return `Error deleting event: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}