-- Create table to track sync status
CREATE TABLE IF NOT EXISTS essence_sync_status (
  id INT PRIMARY KEY,
  last_sync TIMESTAMPTZ NOT NULL,
  last_timestamp BIGINT NOT NULL DEFAULT 0,
  transactions_processed INT NOT NULL,
  has_more BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create trigger for updated_at
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_essence_sync_status_modtime') THEN
    CREATE TRIGGER update_essence_sync_status_modtime
    BEFORE UPDATE ON essence_sync_status
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$; 