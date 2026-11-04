import type { Enums } from '@infra/supabase';

export type InviteRole = Enums<'membership_role'>;

export interface GymInvite {
  id: string;
  role: InviteRole;
  token: string;
  url: string;
}

export interface InvitePreview {
  gymName: string;
  role: InviteRole;
  /** Public URL of the academy logo, when it has one. */
  logoUrl: string | null;
}

/** Name + logo shown before joining with the short code. */
export interface CodePreview {
  gymName: string;
  logoUrl: string | null;
}

export interface GymSettings {
  id: string;
  name: string;
  /** IANA zone, e.g. America/Sao_Paulo. Defines "today" for classes. */
  timezone: string;
  logoPath: string | null;
  logoUrl: string | null;
}
