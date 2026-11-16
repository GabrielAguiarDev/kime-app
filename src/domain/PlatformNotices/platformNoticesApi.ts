import { supabase } from '@infra/supabase';

/** Notices for the caller's roles, newest first (not ended, not dismissed). */
async function listFeed() {
  const { data, error } = await supabase.rpc('platform_announcements_feed');
  if (error) throw error;
  return data;
}

/** "Entendi": the notice stops showing for this account (every device). */
async function dismiss(id: string) {
  const { error } = await supabase.rpc('dismiss_platform_announcement', { p_announcement_id: id });
  if (error) throw error;
}

type GeneratedRow = Awaited<ReturnType<typeof listFeed>>[number];
/** The generator types every RPC column as non-null; `ends_on` is null without a last day. */
export type PlatformNoticeRowApi = Omit<GeneratedRow, 'ends_on'> & { ends_on: string | null };

export const platformNoticesApi = { listFeed, dismiss };
