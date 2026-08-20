-- Relocate btree_gist outside the exposed public schema without recreating
-- dependent GiST exclusion constraints.
BEGIN;

CREATE SCHEMA IF NOT EXISTS extensions;
ALTER EXTENSION btree_gist SET SCHEMA extensions;

COMMIT;
