import { AppState } from 'react-native';
import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@infra/supabase';
import { createServerClock } from '../../../shared/serverClock';
import type { TvTimerSnapshot } from '../../../shared/tvTimer';

const db = supabase as unknown as SupabaseClient;
export interface TvDisplay { id: string; academy_id: string | null; name: string; last_seen_at: string | null; state_version: number; timer_state: TvTimerSnapshot | null }
let connected: TvDisplay | null = null;
let pending: TvTimerSnapshot | null | undefined;
let failed = false;
let snapshot: { display: TvDisplay | null; failed: boolean } = { display: null, failed: false };
let writing = false;
const listeners = new Set<() => void>();
const clock = createServerClock(async () => {
  const { data, error } = await db.rpc('server_now');
  if (error) throw error;
  return Date.parse(data as string);
});
const emit = () => { snapshot = { display: connected, failed }; listeners.forEach(l => l()); };
export function subscribeTv(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; }
export function getTvConnection() { return snapshot; }
// Keep the aligned epoch for the current local session after disconnecting.
export function timerNow() { return clock.now(); }
export async function listTvs(academyId: string): Promise<TvDisplay[]> {
  const { data, error } = await db.from('tv_displays').select('id,academy_id,name,last_seen_at,state_version,timer_state').eq('academy_id', academyId).order('name');
  if (error) throw error;
  return data as TvDisplay[];
}
export async function pairTv(code: string, academyId: string, name: string): Promise<TvDisplay> {
  const { data, error } = await db.rpc('pair_tv', { p_code: code.trim().toUpperCase(), p_academy_id: academyId, p_name: name });
  if (error) throw error;
  return data as TvDisplay;
}
export async function unpairTv(id: string) {
  const { error } = await db.rpc('unpair_tv', { p_display_id: id });
  if (error) throw error;
  if (connected?.id === id) disconnectTv(false);
}
export async function connectTv(row: TvDisplay) {
  const previousOffset = clock.now() - Date.now();
  const old = connected && connected.id !== row.id ? connected : null;
  await clock.sync();
  const offset = clock.now() - Date.now();
  if (old) void clearDisplay(old).catch(() => undefined);
  connected = row; failed = false; pending = undefined; emit();
  return offset - previousOffset;
}
async function clearDisplay(row: TvDisplay) {
  const latest = await db.from('tv_displays').select('id,state_version').eq('id', row.id).maybeSingle();
  if (latest.data) await db.rpc('update_tv_timer', { p_display_id: row.id, p_state: null, p_expected_version: latest.data.state_version });
}
export function disconnectTv(clear = true) {
  if (connected && clear) void clearDisplay(connected).catch(() => undefined);
  connected = null; pending = undefined; failed = false; emit();
}
export function publishTvTimer(state: TvTimerSnapshot | null) {
  if (!connected) return;
  pending = state;
  void flush();
}
async function flush() {
  if (writing || !connected || pending === undefined) return;
  writing = true;
  try {
    while (connected && pending !== undefined) {
      const row: TvDisplay = connected;
      const state: TvTimerSnapshot | null = pending;
      pending = undefined;
      const { data, error } = await db.rpc('update_tv_timer', { p_display_id: row.id, p_state: state, p_expected_version: row.state_version });
      if (connected?.id !== row.id) continue;
      if (error) {
        if (error.code === '40001') {
          const latest = await db.from('tv_displays').select('id,academy_id,name,last_seen_at,state_version,timer_state').eq('id', connected.id).single();
          if (latest.data?.academy_id === connected.academy_id) { connected = latest.data as TvDisplay; pending = pending ?? state; continue; }
          disconnectTv(); break;
        }
        if (error.code === '42501') { disconnectTv(false); break; }
        pending = pending ?? state;
        failed = true; emit(); break;
      }
      connected = data as TvDisplay;
      failed = false; emit();
    }
  } finally { writing = false; }
}
setInterval(() => { if (connected && pending !== undefined) void clock.sync().then(flush).catch(() => undefined); }, 5000);
AppState.addEventListener('change', s => { if (s === 'active' && connected) void clock.sync().then(flush).catch(() => undefined); });
