// src/integrations/CalendarIntegration.ts
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';

const TOKEN_PATH = path.join(process.cwd(), 'google_token.json');
const CREDENTIALS_PATH = path.join(process.cwd(), 'google_credentials.json');

export class CalendarIntegration {
  private async getAuth() {
    const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
    const tokens = JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
    const { client_secret, client_id, redirect_uris } = credentials.installed;
    const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirect_uris[0]);
    oAuth2Client.setCredentials(tokens);
    return oAuth2Client;
  }

  async createEvent(summary: string, startTime: string, endTime: string): Promise<string> {
    try {
      const auth = await this.getAuth();
      const calendar = google.calendar({ version: 'v3', auth });

      const event = {
        summary: summary,
        start: {
          dateTime: startTime, // e.g., '2026-07-07T10:00:00-07:00'
          timeZone: 'America/Los_Angeles',
        },
        end: {
          dateTime: endTime,
          timeZone: 'America/Los_Angeles',
        },
      };

      const response = await calendar.events.insert({
        calendarId: 'primary',
        requestBody: event,
      });

      return `Successfully created calendar event: ${response.data.summary} (${response.data.htmlLink})`;
    } catch (error) {
      return `Error creating calendar event: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}