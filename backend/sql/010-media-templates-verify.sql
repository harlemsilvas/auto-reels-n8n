\set ON_ERROR_STOP on

DO $$
DECLARE
  missing_count integer;
BEGIN
  SELECT COUNT(*)
  INTO missing_count
  FROM (
    VALUES
      ('media_templates'),
      ('media_template_items'),
      ('media_template_text_variants')
  ) AS expected(table_name)
  WHERE to_regclass(expected.table_name) IS NULL;

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration 010 incompleta: % tabela(s) ausente(s).', missing_count;
  END IF;

  SELECT COUNT(*)
  INTO missing_count
  FROM (
    VALUES
      ('media_templates', 'workspace_id'),
      ('media_templates', 'tag'),
      ('media_templates', 'name'),
      ('media_templates', 'status'),
      ('media_templates', 'allowed_claims'),
      ('media_templates', 'forbidden_claims'),
      ('media_templates', 'base_hashtags'),
      ('media_template_items', 'template_id'),
      ('media_template_items', 'workspace_id'),
      ('media_template_items', 'media_kind'),
      ('media_template_items', 'role'),
      ('media_template_items', 'stored_filename'),
      ('media_template_items', 'storage_path'),
      ('media_template_text_variants', 'template_id'),
      ('media_template_text_variants', 'workspace_id'),
      ('media_template_text_variants', 'publish_type'),
      ('media_template_text_variants', 'caption'),
      ('media_template_text_variants', 'hashtags'),
      ('posts', 'media_template_id'),
      ('posts', 'media_template_text_variant_id')
  ) AS expected(table_name, column_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = expected.table_name
      AND c.column_name = expected.column_name
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration 010 incompleta: % coluna(s) ausente(s).', missing_count;
  END IF;

  SELECT COUNT(*)
  INTO missing_count
  FROM (
    VALUES
      ('media_templates_tag_format_check'),
      ('media_templates_name_not_blank_check'),
      ('media_templates_category_not_blank_check'),
      ('media_templates_status_check'),
      ('media_templates_claims_arrays_check'),
      ('media_template_items_media_kind_check'),
      ('media_template_items_role_check'),
      ('media_template_items_numbers_check'),
      ('media_template_text_variants_publish_type_check'),
      ('media_template_text_variants_status_check'),
      ('media_template_text_variants_content_check'),
      ('posts_media_template_fk'),
      ('posts_media_template_text_variant_fk')
  ) AS expected(conname)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = expected.conname
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration 010 incompleta: % constraint(s) ausente(s).', missing_count;
  END IF;

  SELECT COUNT(*)
  INTO missing_count
  FROM (
    VALUES
      ('uq_media_templates_workspace_tag_active'),
      ('idx_media_templates_workspace_status'),
      ('idx_media_templates_tag'),
      ('idx_media_templates_created_by_user'),
      ('idx_media_template_items_template'),
      ('idx_media_template_items_workspace'),
      ('uq_media_template_items_template_sort_active'),
      ('idx_media_template_text_variants_template'),
      ('idx_media_template_text_variants_workspace_status'),
      ('idx_media_template_text_variants_publish_type'),
      ('idx_posts_media_template_id'),
      ('idx_posts_media_template_text_variant_id')
  ) AS expected(indexname)
  WHERE NOT EXISTS (
    SELECT 1
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname = expected.indexname
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration 010 incompleta: % indice(s) ausente(s).', missing_count;
  END IF;

  SELECT COUNT(*)
  INTO missing_count
  FROM (
    VALUES
      ('trg_media_templates_updated_at'),
      ('trg_media_template_text_variants_updated_at')
  ) AS expected(trigger_name)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.triggers
    WHERE trigger_schema = 'public'
      AND trigger_name = expected.trigger_name
  );

  IF missing_count > 0 THEN
    RAISE EXCEPTION 'Migration 010 incompleta: % trigger(s) ausente(s).', missing_count;
  END IF;
END $$;

SELECT
  '010-media-templates ok' AS status,
  COUNT(*) FILTER (WHERE table_name = 'media_templates') AS media_templates_columns,
  COUNT(*) FILTER (WHERE table_name = 'media_template_items') AS media_template_items_columns,
  COUNT(*) FILTER (WHERE table_name = 'media_template_text_variants') AS media_template_text_variants_columns
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name IN (
    'media_templates',
    'media_template_items',
    'media_template_text_variants'
  );
