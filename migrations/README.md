# Migrations - CAH cleanup

This directory contains migration helpers for removing the Cards Against Humanity (CAH) feature from the database.

Primary files:

- `20251018_remove_cah_with_log.sql` — a single-file migration that supports two modes:
  - `rename` (safe): moves CAH tables from the target schema into a timestamped `cah_backup_YYYYMMDD_HHMMSS` schema.
  - `drop` (destructive): drops the CAH tables with `IF EXISTS ... CASCADE`.
  The migration logs every action into `public.schema_migration_log` so you can audit what ran.

IMPORTANT: Always back up your database before running destructive operations. The examples below show how to make backups and how to run the migration safely.

---

## Quick checklist before running

1. Take a backup (recommended). See commands below.
2. Confirm the target schema exists and that you know which schema holds CAH tables (e.g., `cah_schema` or `public`).
3. Ensure your DB user has privileges to create schemas (rename path) or drop tables (drop path).
4. Run the migration in `rename` mode first to verify results, then decide whether to drop.

## Backups (examples)

Replace placeholders: `<host>`, `<port>`, `<user>`, `<db>`, `<SCHEMA_NAME>`, and file paths.

Full database backup (custom, compressed):

```bash
PGPASSWORD='<db_password>' pg_dump -h <host> -p <port> -U <user> -F c -b -v -f /tmp/discord_bot_full_backup_$(date +%F).dump <db>
```

Backup just the CAH tables (schema-scoped, faster):

```bash
PGPASSWORD='<db_password>' pg_dump -h <host> -p <port> -U <user> -d <db> \
  -n <SCHEMA_NAME> \
  -t <SCHEMA_NAME>.cah_white_cards \
  -t <SCHEMA_NAME>.cah_black_cards \
  -t <SCHEMA_NAME>.cah_games \
  -t <SCHEMA_NAME>.cah_game_players \
  -t <SCHEMA_NAME>.cah_game_submissions \
  -t <SCHEMA_NAME>.cah_game_stats \
  -F c -v -f /tmp/cah_tables_backup_$(date +%F).dump
```

Notes:
- The `-F c` option creates a custom-format dump suitable for `pg_restore`.
- You may omit `-n <SCHEMA_NAME>` if your tables live in `public` and you only specify `-t schema.table` entries.

## How to run the migration

Two methods: (A) via a single psql invocation that sets session variables, or (B) open psql and set configs interactively.

Replace `<SCHEMA_NAME>` with your schema (e.g., `cah_schema` or `public`).

A) Single-command (rename mode example):

```bash
PGPASSWORD='<db_password>' psql -h <host> -p <port> -U <user> -d <db> \
  -c "SELECT set_config('app.cah_target_schema','<SCHEMA_NAME>', false);" \
  -c "SELECT set_config('app.cah_migration_action','rename', false);" \
  -f migrations/20251018_remove_cah_with_log.sql
```

B) Interactive psql session:

```sql
-- inside psql connected to your DB
SELECT set_config('app.cah_target_schema','<SCHEMA_NAME>', false);
SELECT set_config('app.cah_migration_action','rename', false); -- or 'drop'
\i migrations/20251018_remove_cah_with_log.sql
```

Start with `rename` to move tables to a backup schema and review the `public.schema_migration_log` entries. Only switch to `drop` after you are satisfied the backup is correct and you no longer need the data.

## Verifying results

After the migration completes, inspect the migration log and the schemas:

```sql
-- Recent migration log entries
SELECT * FROM public.schema_migration_log ORDER BY created_at DESC LIMIT 50;

-- If rename mode: show backup schemas created
SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'cah_backup_%' ORDER BY schema_name DESC;

-- List tables in the backup schema (example for first backup):
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = 'cah_backup_YYYYMMDD_HHMMSS';

-- Confirm no CAH tables remain in the original schema:
SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema = '<SCHEMA_NAME>' AND table_name LIKE 'cah_%';
```

## Rollback (if you used rename path)

If you used the rename path, you can quickly move tables back from the backup schema to the original schema:

```sql
-- Example: move cah_games back
ALTER TABLE cah_backup_YYYYMMDD_HHMMSS.cah_games SET SCHEMA <SCHEMA_NAME>;

-- Repeat for any other tables you want restored.
```

## Restoring from pg_dump (if you used pg_dump backup)

Restore the custom dump produced earlier with `pg_restore`:

```bash
PGPASSWORD='<db_password>' pg_restore -h <host> -p <port> -U <user> -d <db> -v /tmp/cah_tables_backup_YYYY-MM-DD.dump
```

Notes:
- `pg_restore` can restore to a different schema using `--schema` remapping options or by editing the dump.
- If the dump has `CREATE SCHEMA` statements, consider `--no-owner` or `--role` options when restoring into a different environment.

## Permissions & extensions

- The migration creates a log table in `public` named `schema_migration_log`. The executing user needs `CREATE` privileges on the target schemas (rename path) and appropriate `DROP` privileges for the drop path.
- The migration uses `gen_random_uuid()` for IDs; ensure the `pgcrypto` extension is available and enabled in the database (superuser required to create the extension):

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

## Safety tips

- Start with `rename` instead of `drop` to avoid accidental destructive changes.
- Keep your backups off the database host and verify restoration on a test instance before dropping production data.
- Schedule destructive operations during a maintenance window and notify affected users.

---

If you'd like, I can also generate a small script (`scripts/run_cah_migration.sh`) that wraps the psql invocation with environment-variable driven parameters and runs pre-flight checks. Say the word and I'll add it.
