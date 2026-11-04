import Storage from 'expo-sqlite/kv-store';

import type { WaterLog } from './waterTypes';

// Per user: logs of one account never show up for another on the same device.
const key = (userId: string) => `kimi.water.v1.${userId}`;

function read(userId: string): WaterLog[] {
  const raw = Storage.getItemSync(key(userId));
  if (!raw) return [];
  try {
    return JSON.parse(raw) as WaterLog[];
  } catch {
    return [];
  }
}

function write(userId: string, logs: WaterLog[]): void {
  Storage.setItemSync(key(userId), JSON.stringify(logs));
}

export const waterLocalStore = { read, write };
