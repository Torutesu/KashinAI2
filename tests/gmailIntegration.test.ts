// tests/gmailIntegration.test.ts
//
// Verifies email-header-injection is blocked at the integration boundary
// (the P0 fix). These throw before any auth/network, so no mocking is needed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GmailIntegration } from '../src/integrations/GmailIntegration';

test('sendEmail rejects a newline-injected recipient', async () => {
  const out = await new GmailIntegration().sendEmail('a@b.com\nBcc: evil@x.com', 'Subject', 'Body');
  assert.match(out, /line breaks are not allowed/i);
});

test('sendEmail rejects a CRLF-injected subject', async () => {
  const out = await new GmailIntegration().sendEmail('a@b.com', 'Subject\r\nX-Evil: 1', 'Body');
  assert.match(out, /line breaks are not allowed/i);
});

test('createDraft rejects a newline-injected recipient', async () => {
  const out = await new GmailIntegration().createDraft('a@b.com\nBcc: evil@x.com', 'Subject', 'Body');
  assert.match(out, /line breaks are not allowed/i);
});
