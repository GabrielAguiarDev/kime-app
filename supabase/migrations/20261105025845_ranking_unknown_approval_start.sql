-- A join request's created_at is NOT proof of when it was approved. For
-- legacy active students without decided_at, start eligibility now instead
-- of inventing an approval date. Normal approval histories are unchanged.
update private.membership_active_periods ap
set starts_at = now()
from public.memberships m
where m.id = ap.membership_id
  and m.role = 'student' and m.status = 'active'
  and m.decided_at is null
  and ap.starts_at = m.created_at
  and ap.ends_at is null;
