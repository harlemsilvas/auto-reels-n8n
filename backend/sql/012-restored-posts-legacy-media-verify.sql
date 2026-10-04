\set ON_ERROR_STOP on
\pset pager off
DO $$
BEGIN
 IF (SELECT COUNT(*) FROM information_schema.columns
     WHERE table_schema='public' AND table_name='posts'
     AND ((column_name='video_filename' AND data_type='text')
       OR (column_name='media_size' AND data_type='bigint')
       OR (column_name='media_file_path' AND data_type='text')
       OR (column_name='media_deleted_at' AND data_type='timestamp with time zone'))) <> 4
 THEN RAISE EXCEPTION 'Colunas de mídia legadas ausentes ou incompatíveis'; END IF;
END $$;
SELECT column_name,data_type,is_nullable FROM information_schema.columns
WHERE table_schema='public' AND table_name='posts'
AND column_name IN ('video_filename','media_size','media_file_path','media_deleted_at')
ORDER BY column_name;
SELECT status,COUNT(*) FROM posts GROUP BY status ORDER BY status;
