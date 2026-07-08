// src/auth/googleAuth.ts
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import http from 'http';
import { URL } from 'url';

const CREDENTIALS_PATH = path.join(process.cwd(), 'google_credentials.json');
const TOKEN_PATH = path.join(process.cwd(), 'google_token.json');

export async function authenticate(): Promise<any> {
  if (fs.existsSync(TOKEN_PATH)) {
    console.log('Token already exists. Delete google_token.json if you want to re-authenticate.');
    return JSON.parse(fs.readFileSync(TOKEN_PATH, 'utf-8'));
  }

  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error("Missing google_credentials.json.");
  }

  const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, 'utf-8'));
  const { client_secret, client_id } = credentials.installed;

  // Use port 8080 to avoid conflicts with your main server on 3001
  const redirectUri = 'http://localhost:8080';
  const oAuth2Client = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/gmail.compose',
      'https://www.googleapis.com/auth/gmail.readonly', // <-- ADDED THIS SCOPE
      'https://www.googleapis.com/auth/calendar.events'
    ],
  });

  console.log('\n====================================================================');
  console.log('Authorize this app by visiting this URL:');
  console.log(authUrl);
  console.log('====================================================================\n');

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const reqUrl = new URL(req.url || '', 'http://localhost:8080');
        const code = reqUrl.searchParams.get('code');
        const error = reqUrl.searchParams.get('error');

        if (error) {
          res.writeHead(400, { 'Content-Type': 'text/plain' });
          res.end(`Authorization denied: ${error}`);
          server.close();
          reject(new Error(error));
          return;
        }

        if (code) {
          res.writeHead(200, { 'Content-Type': 'text/plain' });
          res.end('Authentication successful! You can close this window and return to the terminal.');
          server.close();

          const tokenResponse = await oAuth2Client.getToken(code);
          fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokenResponse.tokens));
          console.log('\nToken stored to google_token.json');
          resolve(tokenResponse.tokens);
          return;
        }

        // Any other request (e.g. /favicon.ico) — respond so the browser doesn't hang
        res.writeHead(404);
        res.end();
      } catch (e) {
        res.writeHead(500);
        res.end('Error during authentication.');
        reject(e);
      }
    }).listen(8080, () => {
      console.log('Waiting for Google authentication on http://localhost:8080...');
    });
  });
}

authenticate().catch(console.error);