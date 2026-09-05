-- ADR-003 describes the domain schema as granting no privilege to the Data API
-- roles, but Supabase's default privileges hand every new table in `public` to
-- `anon` and `authenticated`. Only RLS stood between them and the data. This
-- revokes the grants and the defaults that keep reinstating them, so a table
-- added later is not exposed by omission.
--
-- The roles are absent from a plain Postgres (the integration harness seeds
-- them), and the owner of `public` is `postgres` on Supabase but the migration
-- user elsewhere, so both are resolved at run time.

DO $$
DECLARE
  api_role text;
  owner_role text := current_user;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'postgres') THEN
    owner_role := 'postgres';
  END IF;

  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    CONTINUE WHEN NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role);

    EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', api_role);
    EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', api_role);
    EXECUTE format('REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM %I', api_role);

    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON TABLES FROM %I',
      owner_role, api_role);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I',
      owner_role, api_role);
    EXECUTE format(
      'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE ALL ON ROUTINES FROM %I',
      owner_role, api_role);
  END LOOP;
END $$;
