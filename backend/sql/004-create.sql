
ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS provider VARCHAR(50);

ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS event_type VARCHAR(100);

ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS payload JSONB;

ALTER TABLE webhook_events
ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW();

SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'webhook_events' ORDER BY ordinal_position;

