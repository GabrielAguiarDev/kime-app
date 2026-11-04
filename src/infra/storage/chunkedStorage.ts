interface AsyncStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}
type Manifest = { generation: string; count: number };

/** Chunks are <= 1,600 UTF-8 bytes. Commit the manifest only after all chunks
 * are written. Serialize operations to prevent refresh/sign-out races. */
export function createChunkedStorage(store: AsyncStorage, randomId: () => string): AsyncStorage {
  let tail: Promise<unknown> = Promise.resolve();
  function serialized<T>(operation: () => Promise<T>): Promise<T> {
    const next = tail.then(operation);
    tail = next.catch(() => undefined);
    return next;
  }
  async function manifest(key: string): Promise<Manifest | null> {
    const raw = await store.getItem(key);
    if (raw === null) return null;
    const value = JSON.parse(raw) as Manifest;
    if (!/^[a-zA-Z0-9-]+$/.test(value.generation) ||
        !Number.isSafeInteger(value.count) || value.count < 0 || value.count > 10000) {
      throw new Error('Invalid secure session manifest');
    }
    return value;
  }
  const chunkKey = (key: string, value: Manifest, index: number) =>
    `${key}.${value.generation}.${index}`;
  async function cleanup(key: string, value: Manifest | null) {
    if (value) await Promise.all(Array.from({ length: value.count }, (_, index) =>
      store.removeItem(chunkKey(key, value, index))));
  }
  return {
    getItem: (key) => serialized(async () => {
      const value = await manifest(key);
      if (!value) return null;
      const chunks = await Promise.all(Array.from({ length: value.count }, (_, index) =>
        store.getItem(chunkKey(key, value, index))));
      if (chunks.some((chunk) => chunk === null)) throw new Error('Incomplete secure session');
      return chunks.join('');
    }),
    setItem: (key, text) => serialized(async () => {
      const previous = await manifest(key);
      const characters = Array.from(text);
      const next = { generation: randomId(), count: Math.ceil(characters.length / 400) };
      try {
        for (let index = 0; index < next.count; index++) {
          await store.setItem(chunkKey(key, next, index),
            characters.slice(index * 400, (index + 1) * 400).join(''));
        }
        await store.setItem(key, JSON.stringify(next));
      } catch (error) {
        await cleanup(key, next).catch(() => undefined);
        throw error;
      }
      // A committed refresh stays successful even if old-chunk cleanup fails.
      await cleanup(key, previous).catch(() => undefined);
    }),
    removeItem: (key) => serialized(async () => {
      const previous = await manifest(key);
      await store.removeItem(key);
      await cleanup(key, previous);
    }),
  };
}
