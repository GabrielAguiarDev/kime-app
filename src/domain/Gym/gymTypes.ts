import type { Enums } from '@infra/supabase';

export type InviteRole = Enums<'invite_role'>;

export interface GymInvite {
  id: string;
  role: InviteRole;
  token: string;
  url: string;
}

export interface InvitePreview {
  gymName: string;
  role: InviteRole;
}
