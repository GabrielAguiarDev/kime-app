import { logoUrl, type CodeLookupApi, type GymSettingsRowApi, type JoinResultApi, type ProfessorCodeRowApi } from './gymApi';
import type { CodeLookup, GymSettings, JoinResult, ProfessorCode } from './gymTypes';

function toCodeLookup(row: CodeLookupApi): CodeLookup {
  return {
    gymName: row.academy_name,
    logoUrl: logoUrl(row.logo_path),
    // lookup_invite_code only returns student or professor.
    codeType: row.code_type === 'instructor' ? 'instructor' : 'student',
  };
}

function toJoinResult(row: JoinResultApi): JoinResult {
  return { membershipId: row.membership_id, gymId: row.academy_id, status: row.status, isNew: row.is_new };
}

function toProfessorCode(row: ProfessorCodeRowApi): ProfessorCode {
  return { id: row.id, code: row.code, expiresAt: row.expires_at };
}

function toSettings(row: GymSettingsRowApi): GymSettings {
  return { id: row.id, name: row.name, timezone: row.timezone, logoPath: row.logo_path, logoUrl: logoUrl(row.logo_path) };
}

export const gymAdapter = { toCodeLookup, toJoinResult, toProfessorCode, toSettings };
