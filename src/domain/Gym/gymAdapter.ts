import { logoUrl, type CodeLookupApi, type GymSettingsRowApi, type InviteCodeRowApi, type JoinResultApi } from './gymApi';
import type { CodeLookup, GymSettings, InviteCodes, JoinResult } from './gymTypes';

function toCodeLookup(row: CodeLookupApi): CodeLookup {
  return {
    gymName: row.academy_name,
    logoUrl: logoUrl(row.logo_path),
    // lookup_invite_code only returns student or instructor codes.
    codeType: row.code_type === 'instructor' ? 'instructor' : 'student',
  };
}

function toJoinResult(row: JoinResultApi): JoinResult {
  return { membershipId: row.membership_id, gymId: row.academy_id, status: row.status, isNew: row.is_new };
}

function toInviteCodes(rows: InviteCodeRowApi[]): InviteCodes {
  const codes: InviteCodes = {};
  for (const r of rows) {
    if (r.code_type === 'student' || r.code_type === 'instructor') codes[r.code_type] = r.code;
  }
  return codes;
}

function toSettings(row: GymSettingsRowApi): GymSettings {
  return { id: row.id, name: row.name, timezone: row.timezone, logoPath: row.logo_path, logoUrl: logoUrl(row.logo_path) };
}

export const gymAdapter = { toCodeLookup, toJoinResult, toInviteCodes, toSettings };
