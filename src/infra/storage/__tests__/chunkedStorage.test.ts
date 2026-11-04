import { createChunkedStorage } from '../chunkedStorage';

function setup() {
  const data = new Map<string, string>();
  let sequence = 0;
  const store = {
    getItem: jest.fn(async (key: string) => data.get(key) ?? null),
    setItem: jest.fn(async (key: string, value: string) => {
      if (Buffer.byteLength(value, 'utf8') > 1800) throw new Error('too large');
      data.set(key, value);
    }),
    removeItem: jest.fn(async (key: string) => { data.delete(key); }),
  };
  return { data, store, storage: createChunkedStorage(store, () => `generation-${++sequence}`) };
}

test('round-trips large Unicode sessions within platform byte limits and removes all chunks', async () => {
  const { storage, data } = setup();
  const session = JSON.stringify({ token: 'jwt'.repeat(4000), name: '🥋'.repeat(900) });
  await storage.setItem('session', session);
  expect(await storage.getItem('session')).toBe(session);
  await storage.removeItem('session');
  expect(await storage.getItem('session')).toBeNull();
  expect(data.size).toBe(0);
});

test('a failed refresh preserves the previous session', async () => {
  const { storage, store } = setup();
  await storage.setItem('session', 'previous');
  store.setItem.mockRejectedValueOnce(new Error('Keychain unavailable'));
  await expect(storage.setItem('session', 'new'.repeat(900))).rejects.toThrow('Keychain');
  expect(await storage.getItem('session')).toBe('previous');
});

test('serializes concurrent refresh and sign-out without resurrecting the session', async () => {
  const { storage, data } = setup();
  await Promise.all([storage.setItem('session', 'initial'),
    storage.setItem('session', 'refresh'.repeat(700)), storage.removeItem('session')]);
  expect(await storage.getItem('session')).toBeNull();
  expect(data.size).toBe(0);
});

test('fails closed when a committed chunk is missing', async () => {
  const { storage, data } = setup();
  await storage.setItem('session', 'session');
  data.delete('session.generation-1.0');
  await expect(storage.getItem('session')).rejects.toThrow('Incomplete');
});
