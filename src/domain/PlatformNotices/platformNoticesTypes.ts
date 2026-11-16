import type { LocalDate } from '@domain/Classes';

/** Who a notice from the Kimi team is for (filtered by the server). */
export type PlatformNoticeAudience = 'owners' | 'staff' | 'everyone';

/**
 * A notice from the Kimi team (admin web), not from the academy. The feed
 * already drops the ones past their last day and the ones the person
 * dismissed ("Entendi", stored per account).
 */
export interface PlatformNotice {
  id: string;
  title: string;
  body: string;
  audience: PlatformNoticeAudience;
  /** Last day shown (inclusive); null = no end. */
  endsOn: LocalDate | null;
  createdAt: string;
}
