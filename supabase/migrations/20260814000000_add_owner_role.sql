-- Owner role: standalone enum extension (non-transactional DDL).
-- Must be applied BEFORE any migration referencing 'owner'.

ALTER TYPE public.role_enum ADD VALUE 'owner';
