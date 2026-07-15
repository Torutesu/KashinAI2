// tests/inputValidation.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assertSafeHeaderValue, isSafeHttpUrl } from '../src/security/inputValidation';

test('assertSafeHeaderValue returns clean values unchanged', () => {
  assert.equal(assertSafeHeaderValue('recipient', 'bob@example.com'), 'bob@example.com');
  assert.equal(assertSafeHeaderValue('subject', 'Hello there'), 'Hello there');
});

test('assertSafeHeaderValue rejects newline injection', () => {
  assert.throws(() => assertSafeHeaderValue('recipient', 'bob@example.com\nBcc: evil@x.com'));
  assert.throws(() => assertSafeHeaderValue('subject', 'Hi\r\nX-Injected: 1'));
  assert.throws(() => assertSafeHeaderValue('subject', 'line1\rline2'));
});

test('isSafeHttpUrl allows http and https only', () => {
  assert.equal(isSafeHttpUrl('http://example.com'), true);
  assert.equal(isSafeHttpUrl('https://example.com/path?q=1'), true);
});

test('isSafeHttpUrl blocks dangerous schemes and garbage', () => {
  assert.equal(isSafeHttpUrl('file:///etc/passwd'), false);
  assert.equal(isSafeHttpUrl('javascript:alert(1)'), false);
  assert.equal(isSafeHttpUrl('data:text/html,<script>1</script>'), false);
  assert.equal(isSafeHttpUrl('ftp://example.com'), false);
  assert.equal(isSafeHttpUrl('not a url'), false);
  assert.equal(isSafeHttpUrl(''), false);
});
