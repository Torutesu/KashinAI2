// tests/conversationStore.test.ts
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryConversationStore, MAX_HISTORY_MESSAGES } from '../src/memory/ConversationStore';
import type { LLMHistoryMessage } from '../src/types';

const msg = (role: 'user' | 'model', text: string): LLMHistoryMessage => ({ role, parts: [{ text }] });

test('load returns empty for an unknown session', async () => {
  const store = new InMemoryConversationStore();
  assert.deepEqual(await store.load('nope'), []);
});

test('append then load round-trips within a session', async () => {
  const store = new InMemoryConversationStore();
  await store.append('s1', [msg('user', 'hi'), msg('model', 'hello')]);
  const loaded = await store.load('s1');
  assert.equal(loaded.length, 2);
  assert.equal(loaded[0].parts[0].text, 'hi');
  assert.equal(loaded[1].role, 'model');
});

test('sessions are isolated', async () => {
  const store = new InMemoryConversationStore();
  await store.append('a', [msg('user', 'alpha')]);
  await store.append('b', [msg('user', 'beta')]);
  assert.equal((await store.load('a')).length, 1);
  assert.equal((await store.load('a'))[0].parts[0].text, 'alpha');
});

test('history is capped to the most recent MAX messages', async () => {
  const store = new InMemoryConversationStore();
  for (let i = 0; i < MAX_HISTORY_MESSAGES + 10; i++) {
    await store.append('s', [msg('user', `m${i}`)]);
  }
  const loaded = await store.load('s');
  assert.equal(loaded.length, MAX_HISTORY_MESSAGES);
  // Oldest kept message should be the (i=10) one after dropping the first 10.
  assert.equal(loaded[0].parts[0].text, 'm10');
});
