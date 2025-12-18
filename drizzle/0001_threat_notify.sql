-- Trigger function to notify on new threat insertions
-- This enables real-time SSE streaming via Postgres LISTEN/NOTIFY

CREATE OR REPLACE FUNCTION notify_threat_insert()
RETURNS TRIGGER AS $$
BEGIN
  -- Send notification with the new row as JSON
  PERFORM pg_notify('new_threat', row_to_json(NEW)::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on threat_logs table
DROP TRIGGER IF EXISTS threat_insert_trigger ON threat_logs;

CREATE TRIGGER threat_insert_trigger
AFTER INSERT ON threat_logs
FOR EACH ROW EXECUTE FUNCTION notify_threat_insert();
