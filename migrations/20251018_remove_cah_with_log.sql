-- migrations/20251018_remove_cah_with_log.sql
-- Purpose: Schema-scoped CAH cleanup migration with action logging.
-- Usage:
--   Set the target schema and action via session settings, then run the file in psql:
--     SELECT set_config('app.cah_target_schema','cah_schema', false);
--     SELECT set_config('app.cah_migration_action','rename', false);
--     \i migrations/20251018_remove_cah_with_log.sql
--   action values: 'rename' (safe, moves tables to a timestamped backup schema) or 'drop' (destructive).

-- Safety: Back up the database before running. Default action is 'rename'.

DO
$$
DECLARE
  action text := lower(coalesce(current_setting('app.cah_migration_action', true), 'rename'));
  target_schema text := coalesce(current_setting('app.cah_target_schema', true), 'public');
  backup_schema text;
  tbl text;
  tables text[] := ARRAY[
    'cah_game_submissions',
    'cah_game_players',
    'cah_games',
    'cah_game_stats',
    'cah_white_cards',
    'cah_black_cards'
  ];
  exists_flag boolean;
  log_message text;
  inserted_id uuid;
BEGIN
  IF action NOT IN ('rename','drop') THEN
    RAISE EXCEPTION 'Invalid action: % - set app.cah_migration_action to ''rename'' or ''drop''', action;
  END IF;

  PERFORM 1 FROM information_schema.schemata WHERE schema_name = target_schema;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Target schema "%" not found. Set app.cah_target_schema correctly.', target_schema;
  END IF;

  -- Ensure a migration log table exists in public schema
  CREATE TABLE IF NOT EXISTS public.schema_migration_log (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT now(),
    action text NOT NULL,
    target_schema text NOT NULL,
    object_name text,
    result text,
    details jsonb
  );

  -- Helper to insert a log row
  PERFORM set_config('search_path', 'public', false);

  IF action = 'rename' THEN
    backup_schema := format('cah_backup_%s', to_char(now(),'YYYYMMDD_HH24MISS'));
    EXECUTE format('CREATE SCHEMA IF NOT EXISTS %I', backup_schema);
    log_message := format('rename -> moving CAH tables from % to %', target_schema, backup_schema);
    INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
      VALUES ('rename', target_schema, NULL, 'started', jsonb_build_object('backup_schema', backup_schema));

    FOREACH tbl IN ARRAY tables LOOP
      SELECT EXISTS(
        SELECT 1 FROM information_schema.tables
         WHERE table_schema = target_schema AND table_name = tbl
      ) INTO exists_flag;

      IF exists_flag THEN
        BEGIN
          EXECUTE format('ALTER TABLE %I.%I SET SCHEMA %I', target_schema, tbl, backup_schema);
          INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
            VALUES ('rename', target_schema, tbl, 'moved', jsonb_build_object('to_schema', backup_schema));
        EXCEPTION WHEN OTHERS THEN
          INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
            VALUES ('rename', target_schema, tbl, 'error', jsonb_build_object('error', SQLERRM));
        END;
      ELSE
        INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
          VALUES ('rename', target_schema, tbl, 'not_found', NULL);
      END IF;
    END LOOP;

    INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
      VALUES ('rename', target_schema, NULL, 'completed', jsonb_build_object('backup_schema', backup_schema));

  ELSE
    -- DROP mode
    INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
      VALUES ('drop', target_schema, NULL, 'started', NULL);

    FOREACH tbl IN ARRAY tables LOOP
      BEGIN
        EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', target_schema, tbl);
        INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
          VALUES ('drop', target_schema, tbl, 'dropped_if_exists', NULL);
      EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
          VALUES ('drop', target_schema, tbl, 'error', jsonb_build_object('error', SQLERRM));
      END;
    END LOOP;

    INSERT INTO public.schema_migration_log(action,target_schema,object_name,result,details)
      VALUES ('drop', target_schema, NULL, 'completed', NULL);
  END IF;

END
$$;

-- End of migration
