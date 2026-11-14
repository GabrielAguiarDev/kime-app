import { createClient, type RealtimeChannel } from '@supabase/supabase-js';
import QRCode from 'qrcode';
import { createServerClock } from '../../../shared/serverClock';
import { events, eventsBetween, formatClock, roundsDone, type TimerEvent } from '../../../shared/timer';
import { tvTimerAt, type TvTimerSnapshot } from '../../../shared/tvTimer';
import './style.css';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const root = document.querySelector<HTMLElement>('#app')!;
if (!url || !key) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY');
const db = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
const clock = createServerClock(async () => {
  const { data, error } = await db.rpc('server_now');
  if (error) throw error;
  return Date.parse(data as string);
});
interface Display { id: string; academy_id: string | null; name: string; pairing_code: string | null; pairing_expires_at: string | null; timer_state: TvTimerSnapshot | null; state_version: number }
let display: Display | null = null;
let channel: RealtimeChannel | null = null;
let refreshing = false;
let academyName = '';
let academyLogo = '';
let audioContext: AudioContext | null = null;
let unlocked = false;
let lastElapsed = 0;
let lastVersion = -1;
const sounds: Record<string, AudioBuffer> = {};
const soundBytes: Record<string, ArrayBuffer> = {};
const files = { roundStart: 'bell.wav', roundEnd: 'bell-triple.wav', warning: 'clapper.wav' };
let wakeLock: { release: () => Promise<void> } | null = null;
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]!);
const brand = () => `<div class="brand"><img src="/kimi.png" alt=""><span>KIMI</span></div>`;
const toolbar = () => `<div class="toolbar">${display?.academy_id ? '<button id="disconnect" type="button">Desconectar</button>' : ''}<button id="fullscreen" type="button">Tela cheia</button></div>`;
function bindControls() {
  document.querySelector<HTMLButtonElement>('#fullscreen')?.addEventListener('click', () => void document.documentElement.requestFullscreen?.());
  document.querySelector<HTMLButtonElement>('#disconnect')?.addEventListener('click', showDisconnectConfirm);
  document.onkeydown = e => {
    const dialog = document.querySelector('.disconnect-overlay');
    if (e.key === 'Escape' && dialog) { document.querySelector<HTMLButtonElement>('#disconnect-cancel')?.click(); return; }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const buttons = [...(dialog ?? document).querySelectorAll<HTMLButtonElement>('button')];
      const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
      buttons[(i + (e.key === 'ArrowRight' ? 1 : buttons.length - 1)) % buttons.length]?.focus();
    }
    if (e.key === 'Enter' && document.activeElement === document.body) (dialog ?? document).querySelector<HTMLButtonElement>('button')?.click();
  };
}
function showDisconnectConfirm() {
  if (!display?.academy_id || document.querySelector('.disconnect-overlay')) return;
  const overlay = document.createElement('div');
  overlay.className = 'disconnect-overlay';
  overlay.innerHTML = '<div class="disconnect-dialog" role="dialog" aria-modal="true" aria-labelledby="disconnect-title"><h2 id="disconnect-title">Desconectar esta TV?</h2><p>Ela deixará de receber o timer da academia e mostrará um novo código de pareamento.</p><div class="disconnect-actions"><button id="disconnect-cancel" type="button">Cancelar</button><button id="disconnect-confirm" type="button">Desconectar TV</button></div><p class="disconnect-error" role="alert" hidden></p></div>';
  document.body.appendChild(overlay);
  const cancel = overlay.querySelector<HTMLButtonElement>('#disconnect-cancel')!;
  const confirm = overlay.querySelector<HTMLButtonElement>('#disconnect-confirm')!;
  cancel.addEventListener('click', () => { overlay.remove(); document.querySelector<HTMLButtonElement>('#disconnect')?.focus(); });
  confirm.addEventListener('click', async () => {
    confirm.disabled = true;
    try {
      const { error } = await db.rpc('tv_disconnect_self');
      if (error) throw error;
      location.reload();
    } catch {
      const message = overlay.querySelector<HTMLElement>('.disconnect-error')!;
      message.textContent = 'Não foi possível desconectar. Tente novamente.';
      message.hidden = false;
      confirm.disabled = false;
    }
  });
  cancel.focus();
}
async function unlockSound() {
  audioContext = new AudioContext();
  await audioContext.resume();
  await Promise.all(Object.entries(files).map(async ([name, file]) => {
    if (!soundBytes[name]) soundBytes[name] = await (await fetch(`/sounds/${file}`)).arrayBuffer();
    sounds[name] = await audioContext!.decodeAudioData(soundBytes[name].slice(0));
  }));
  unlocked = true;
  document.querySelector('.sound-overlay')?.remove();
}
function sound(type: string) {
  if (!audioContext || !sounds[type]) return;
  const source = audioContext.createBufferSource(); source.buffer = sounds[type]; source.connect(audioContext.destination); source.start();
}
async function acquireWakeLock() {
  try { wakeLock = await (navigator as Navigator & { wakeLock?: { request: (kind: string) => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request('screen') ?? null; } catch { /* TV may not support it */ }
}
async function refresh() {
  if (refreshing) return;
  refreshing = true;
  try {
  const { data, error } = await db.from('tv_displays').select('*').limit(1).maybeSingle();
  if (error) throw error;
  display = data as Display | null;
  if (!display || (!display.academy_id && (!display.pairing_expires_at || Date.parse(display.pairing_expires_at) <= clock.now()))) {
    const result = await db.rpc('create_tv_pairing');
    if (result.error) throw result.error;
    display = result.data as Display;
  }
  if (display?.academy_id) {
    const result = await db.rpc('tv_academy_brand');
    academyName = result.data?.[0]?.name ?? '';
    const path = result.data?.[0]?.logo_path;
    academyLogo = path ? db.storage.from('academy-logos').getPublicUrl(path).data.publicUrl : '';
  } else { academyName = ''; academyLogo = ''; }
  if (channel) await db.removeChannel(channel);
  if (display) {
    channel = db.channel(`tv-${display.id}`).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tv_displays', filter: `id=eq.${display.id}` }, () => void refresh())
      .subscribe(status => { if (status === 'SUBSCRIBED') void fetchCurrent(); });
  }
  render();
  } finally { refreshing = false; }
}
async function fetchCurrent() {
  const { data } = await db.from('tv_displays').select('*').eq('id', display?.id ?? '').maybeSingle();
  if (data && (data.state_version !== display?.state_version || data.academy_id !== display?.academy_id)) { display = data as Display; render(); }
}
function render() {
  if (!display) { root.innerHTML = `<div>${brand()}<p>Conectando...</p></div>`; return; }
  if (!display.academy_id) {
    root.className = '';
    const code = display.pairing_code ?? '';
    root.innerHTML = `<div>${brand()}<p class="status">Parear esta TV</p><div class="pair-code">${esc(code)}</div><canvas class="qr" id="qr"></canvas><p class="status">No app: Timer → Transmitir na TV</p><p class="muted">O código expira em 10 minutos.</p></div>${toolbar()}`;
    if (code) void QRCode.toCanvas(document.querySelector('#qr'), `kimi://tv?code=${code}`, { margin: 0, width: 240 });
  } else if (!display.timer_state || display.timer_state.status === 'idle') {
    root.className = '';
    root.innerHTML = `<div>${academyLogo ? `<img class="academy-logo" src="${esc(academyLogo)}" alt="">` : brand()}<h1>${esc(academyName)}</h1><p class="status">${esc(display.name)}</p><p class="muted status">Aguardando o timer</p></div>${toolbar()}`;
  } else {
    renderTimer();
  }
  if (!unlocked && !document.querySelector('.sound-overlay')) {
    const overlay = document.createElement('div'); overlay.className = 'sound-overlay';
    overlay.innerHTML = '<button id="enable-sound">Pressione OK para ativar o som</button>';
    document.body.appendChild(overlay);
    overlay.querySelector('button')?.addEventListener('click', () => void unlockSound());
    document.addEventListener('keydown', function once(e) { if (e.key === 'Enter' || e.key === ' ') { document.removeEventListener('keydown', once); void unlockSound(); } });
  }
  bindControls(); void acquireWakeLock();
}
function renderTimer() {
  const snap = display?.timer_state; if (!snap) return;
  const focusedId = (document.activeElement as HTMLElement | null)?.id;
  const { state, segments, finished } = tvTimerAt(snap, clock.now());
  const paused = snap.status === 'paused';
  const phase = finished ? 'finished' : paused ? 'paused' : state.warning ? 'warning' : state.phase;
  root.className = phase;
  const label = finished ? 'Concluído' : paused ? 'Pausado' : state.phase === 'prep' ? 'Prepare-se' : state.phase === 'rest' ? 'Descanso' : 'Round';
  const logo = academyLogo ? `<img class="academy-logo" src="${esc(academyLogo)}" alt="${esc(academyName)}">` : esc(academyName);
  root.innerHTML = `<div class="timer"><div class="timer-top"><span>${esc(snap.title)}</span><span>Round ${state.round} de ${state.rounds}</span></div><div><div class="phase">${label}</div><div class="clock">${formatClock(state.remainingMs)}</div><div class="segments">${Array.from({length:state.rounds},(_,i)=>`<span class="${i<roundsDone(state)?'done':''}"></span>`).join('')}</div></div><div>${logo}</div></div>${toolbar()}`;
  bindControls();
  if (focusedId) document.getElementById(focusedId)?.focus();
  const currentElapsed = Math.max(0, segments.length ? (snap.clock.pausedAt ?? clock.now()) - snap.clock.startedAt - snap.clock.pausedTotalMs : 0);
  if (display!.state_version !== lastVersion) { lastVersion = display!.state_version; lastElapsed = currentElapsed; }
  else if (!paused && !finished) {
    const all: TimerEvent[] = events(snap.config, segments);
    if (currentElapsed - lastElapsed < 1500) eventsBetween(all, lastElapsed, currentElapsed).forEach(e => sound(e.sound));
    lastElapsed = currentElapsed;
  }
}
async function boot() {
  root.innerHTML = `${brand()}<p>Conectando...</p>`;
  const auth = await db.auth.getSession();
  if (!auth.data.session) { const signed = await db.auth.signInAnonymously(); if (signed.error) throw signed.error; }
  void Promise.all(Object.entries(files).map(async ([name, file]) => { soundBytes[name] = await (await fetch(`/sounds/${file}`)).arrayBuffer(); })).catch(() => undefined);
  await clock.sync(); await refresh();
  setInterval(() => { if (display?.academy_id && display.timer_state && display.timer_state.status !== 'idle') renderTimer(); }, 200);
  setInterval(() => { void db.rpc('tv_heartbeat'); }, 30000);
  setInterval(() => { if (display && !display.academy_id && Date.parse(display.pairing_expires_at ?? '') <= clock.now()) void refresh(); }, 1000);
  setInterval(() => void clock.sync().catch(() => undefined), 60000);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) { void clock.sync().then(refresh); void acquireWakeLock(); } });
  window.addEventListener('online', () => void clock.sync().then(refresh));
}
void boot().catch(e => { root.innerHTML = `<div>${brand()}<p>Falha na conexão</p><p>${esc(String(e.message ?? e))}</p><button onclick="location.reload()">Tentar novamente</button></div>`; });
