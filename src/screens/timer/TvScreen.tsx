import { useCameraPermissions } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, ScrollView } from 'react-native';
import { BottomSheet, Box, Button, Card, FeedbackSheet, Text, TextField } from '@components';
import { useActiveGym } from '@services/activeGym';
import { alignTimerClock, getTimerSession } from '@services/timer';
import { connectTv, disconnectTv, getTvConnection, listTvs, pairTv, unpairTv, type TvDisplay } from '@services/tv';

import { TvQrScanner } from './TvQrScanner';

const CODE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;
function extractCode(input: string) {
  const match = /(?:code=)?([A-HJ-NP-Z2-9]{6})/i.exec(input.trim());
  return match?.[1]?.toUpperCase() ?? '';
}
export function TvScreen() {
  const { code: linkCode } = useLocalSearchParams<{ code?: string }>();
  const { active, isStaff } = useActiveGym();
  const [permission, requestPermission] = useCameraPermissions();
  const [code, setCode] = useState(() => extractCode(linkCode ?? ''));
  const [name, setName] = useState('TV do tatame');
  // Full-screen scanner instead of the sheet. The two native modals take turns:
  // each opens only after the other one finished closing ('toScanner' / 'toSheet').
  const [phase, setPhase] = useState<'sheet' | 'toScanner' | 'scanner' | 'toSheet'>('sheet');
  const [cameraDenied, setCameraDenied] = useState(false);
  const [rows, setRows] = useState<TvDisplay[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [open, setOpen] = useState(true);
  const [onlineNow, setOnlineNow] = useState(0);
  const gymId = active?.gymId;
  const refresh = async () => {
    if (!gymId || !isStaff) return;
    try { setRows(await listTvs(gymId)); } catch { setMessage('Não foi possível carregar as TVs.'); }
  };
  useEffect(() => {
    if (!gymId || !isStaff) return;
    let active = true;
    listTvs(gymId).then(data => { if (active) setRows(data); }).catch(() => { if (active) setMessage('Não foi possível carregar as TVs.'); });
    return () => { active = false; };
  }, [gymId, isStaff]);
  useEffect(() => {
    const initial = setTimeout(() => setOnlineNow(Date.now()), 0);
    const id = setInterval(() => setOnlineNow(Date.now()), 30000);
    return () => { clearTimeout(initial); clearInterval(id); };
  }, []);
  // Only the sheet: the route is a transparent modal over the screen that opened it.
  const close = () => { setOpen(false); if (router.canGoBack()) router.back(); else router.replace('/'); };
  const connect = async (row: TvDisplay) => {
    try {
      setBusy(true);
      const delta = await connectTv(row);
      if (getTimerSession()) alignTimerClock(delta);
      close();
    } catch { setMessage('Não foi possível conectar à TV.'); } finally { setBusy(false); }
  };
  const openScanner = async () => {
    const granted = permission?.granted || (await requestPermission()).granted;
    setCameraDenied(!granted);
    if (granted) setPhase('toScanner');
  };
  const closeScanner = () => setPhase(Platform.OS === 'ios' ? 'toSheet' : 'sheet'); // Modal onDismiss is iOS-only
  const onScanned = (data: string) => {
    const found = extractCode(data);
    if (!CODE.test(found)) return false;
    setCode(found);
    closeScanner();
    return true;
  };
  const pair = async () => {
    if (!gymId || !CODE.test(code) || !name.trim()) return;
    try {
      setBusy(true);
      const row = await pairTv(code, gymId, name.trim());
      await connect(row);
    } catch { setMessage('Código inválido ou expirado. Confira o código na TV.'); } finally { setBusy(false); }
  };
  return (
    <>
      <BottomSheet
        visible={open && isStaff && phase === 'sheet'}
        onRequestClose={close}
        onClosed={() => { if (phase === 'toScanner') setPhase('scanner'); }}
      >
        <ScrollView keyboardShouldPersistTaps="handled">
          <Box gap="s16" paddingBottom="s24">
            <Text variant="heading">Parear uma TV</Text>
            {cameraDenied ? <Text variant="body">Permita o acesso à câmera para escanear o QR.</Text> : null}
            <Button title="Escanear QR" variant="secondary" onPress={() => void openScanner()} />
            <TextField label="Código da TV" value={code} onChangeText={v => setCode(extractCode(v) || v.toUpperCase().slice(0,6))} autoCapitalize="characters" maxLength={6} />
            <TextField label="Nome da TV" value={name} onChangeText={setName} maxLength={80} />
            <Button title="Parear e conectar" disabled={busy || !CODE.test(code) || !name.trim()} onPress={() => void pair()} />
            <Text variant="heading">TVs da academia</Text>
            {rows.length === 0 ? <Text variant="body" color="textMuted">Nenhuma TV pareada.</Text> : null}
            {rows.map(row => {
              const online = !!row.last_seen_at && onlineNow - Date.parse(row.last_seen_at) < 90000;
              return <Card key={row.id} gap="s8">
                <Text variant="bodyStrong">{row.name}</Text>
                <Text variant="caption" color={online ? 'success' : 'textMuted'}>{online ? 'Online' : 'Offline'}</Text>
                <Button title="Conectar" variant="secondary" disabled={busy} onPress={() => void connect(row)} />
                <Button title="Desparear" variant="ghost" disabled={busy} onPress={() => void unpairTv(row.id).then(refresh).catch(() => setMessage('Não foi possível desparear.'))} />
              </Card>;
            })}
            {getTvConnection().display ? <Button title="Desconectar desta TV" variant="ghost" onPress={() => { disconnectTv(); close(); }} /> : null}
          </Box>
        </ScrollView>
      </BottomSheet>
      <TvQrScanner
        visible={phase === 'scanner'}
        onScanned={onScanned}
        onCancel={closeScanner}
        onDismissed={() => setPhase('sheet')}
      />
      {!isStaff ? <FeedbackSheet tone="warning" icon="info" title="Acesso restrito" message="Só o dono e professores podem parear e controlar a TV." actionLabel="Voltar" onAction={close} /> : null}
      {message ? <FeedbackSheet tone="warning" icon="warning" title="TV não atualizada" message={message} actionLabel="Entendi" onAction={() => setMessage(null)} /> : null}
    </>
  );
}
