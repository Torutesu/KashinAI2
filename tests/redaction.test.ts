// tests/redaction.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { redactSecrets } from '../src/security/redaction';

// Secret-shaped fixtures are assembled from parts at runtime so no contiguous
// secret literal sits in source (which would trip GitHub push protection). The
// runtime strings still exercise the redaction patterns.
const SK_TOKEN = 'sk-' + 'ABCDEFGHIJKLMNOPQRSTUVWX';
const GH_TOKEN = 'ghp' + '_' + 'ABCDEFGHIJKLMNOPQRSTUVWXYZ012345';
const SLACK_TOKEN = ['xoxb', '1234567890', 'abcdefghijklmno'].join('-');
const JWT = ['eyJhbGciOiJIUzI1NiJ9', 'eyJzdWIiOiIxMjM0NTYifQ', 'SflKxwRJSMeKKF2QT4fwpMe'].join('.');
const BEARER_VALUE = 'abcdef1234567890XYZ';

test('leaves ordinary text untouched', () => {
  const s = 'Met Alice at 3pm to discuss the Q3 roadmap.';
  assert.equal(redactSecrets(s), s);
});

test('redacts provider token shapes', () => {
  assert.ok(!redactSecrets(`key ${SK_TOKEN}`).includes(SK_TOKEN));
  assert.ok(!redactSecrets(`token ${GH_TOKEN}`).includes(GH_TOKEN));
  assert.ok(!redactSecrets(`slack ${SLACK_TOKEN}`).includes(SLACK_TOKEN));
});

test('redacts a JWT', () => {
  assert.ok(!redactSecrets(`auth ${JWT}`).includes('eyJhbGci'));
});

test('redacts key=value secret assignments but keeps the label', () => {
  const out = redactSecrets('password=hunter2 and api_key: SECRETVALUE123');
  assert.ok(out.includes('password='));
  assert.ok(!out.includes('hunter2'));
  assert.ok(out.toLowerCase().includes('api_key'));
  assert.ok(!out.includes('SECRETVALUE123'));
});

test('redacts a Luhn-valid card number but not random digit runs', () => {
  // 4111111111111111 is a standard Luhn-valid test card.
  assert.ok(!redactSecrets('card 4111 1111 1111 1111').includes('4111'));
  // A non-card long number (invalid Luhn) is left alone.
  assert.equal(redactSecrets('order 1234567890123'), 'order 1234567890123');
});

test('redacts a Bearer token but keeps the scheme', () => {
  const out = redactSecrets(`Authorization: Bearer ${BEARER_VALUE}`);
  assert.ok(out.includes('Bearer'));
  assert.ok(!out.includes(BEARER_VALUE));
});
