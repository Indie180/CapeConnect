-- Adds operator isolation metadata to admin audit rows.

ALTER TABLE audit_logs
ADD COLUMN IF NOT EXISTS operator TEXT;

UPDATE audit_logs
SET operator = CASE
  WHEN lower(admin_email) LIKE '%ga-admin%' THEN 'Golden Arrow'
  WHEN lower(admin_email) LIKE '%myciti-admin%' THEN 'MyCiTi'
  ELSE 'Unknown'
END
WHERE operator IS NULL OR btrim(operator) = '';

ALTER TABLE audit_logs
ALTER COLUMN operator SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_audit_logs_operator_at
ON audit_logs(operator, at DESC);
