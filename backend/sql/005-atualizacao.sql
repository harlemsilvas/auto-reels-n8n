BEGIN;

ALTER TABLE uploads ADD COLUMN workspace_id UUID;
ALTER TABLE post_events ADD COLUMN workspace_id UUID;
ALTER TABLE post_metrics ADD COLUMN workspace_id UUID;
UPDATE uploads SET workspace_id = 'a21203ce-21a1-4db4-9d93-46f5b547c2ee' WHERE workspace_id IS NULL;
UPDATE post_events pe SET workspace_id = p.workspace_id FROM posts p WHERE p.id = pe.post_id AND pe.workspace_id IS NULL;
UPDATE post_metrics pm SET workspace_id = p.workspace_id FROM posts p WHERE p.id = pm.post_id AND pm.workspace_id IS NULL;
ALTER TABLE uploads ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE post_events ALTER COLUMN workspace_id SET NOT NULL;
ALTER TABLE post_metrics ALTER COLUMN workspace_id SET NOT NULL;

COMMIT;

