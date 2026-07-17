// tests/config.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateConfig, assertValidConfig } from '../src/config';

test('valid config yields no errors', () => {
  const { errors } = validateConfig({ PORT: '3001', API_TOKEN: 't', GEMINI_API_KEY: 'k', MEMORY_RETENTION_DAYS: '30' } as any);
  assert.equal(errors.length, 0);
});

test('non-numeric numeric vars are errors', () => {
  const { errors } = validateConfig({ PORT: 'abc', RATE_LIMIT_MAX: 'ten' } as any);
  assert.ok(errors.some((e) => e.includes('PORT')));
  assert.ok(errors.some((e) => e.includes('RATE_LIMIT_MAX')));
});

test('missing API_TOKEN / GEMINI_API_KEY are warnings, not errors', () => {
  const { errors, warnings } = validateConfig({} as any);
  assert.equal(errors.length, 0);
  assert.ok(warnings.some((w) => w.includes('API_TOKEN')));
  assert.ok(warnings.some((w) => w.includes('GEMINI_API_KEY')));
});

test('empty numeric var is ignored (uses default downstream)', () => {
  const { errors } = validateConfig({ MEMORY_RETENTION_DAYS: '' } as any);
  assert.equal(errors.length, 0);
});

test('assertValidConfig throws on a hard error, not on warnings', () => {
  assert.throws(() => assertValidConfig({ PORT: 'abc' } as any), /Invalid configuration/);
  assert.doesNotThrow(() => assertValidConfig({ PORT: '3001' } as any)); // missing keys only warn
});
