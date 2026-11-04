-- =============================================================================
-- Kimi — `owner` membership role
-- In its own migration: a new enum value can only be used after the
-- transaction that adds it commits (the next migration uses it).
-- =============================================================================
alter type public.membership_role add value if not exists 'owner' before 'professor';
