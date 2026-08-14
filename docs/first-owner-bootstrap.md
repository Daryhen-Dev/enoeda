# First Owner Bootstrap Runbook

## Purpose

Manually assign the `owner` role to the first user. The application does not provide any runtime mechanism to assign or revoke the `owner` role — this is enforced at the database level.

## Prerequisites

- Access to the Supabase Dashboard (project owner or admin).
- A confirmed Auth user account (email verified, able to log in).
- The `20260814000000_add_owner_role.sql` and `20260814000001_owner_role_management.sql` migrations have been applied.

## Steps

### 1. Identify the target Auth user UUID

1. Open Supabase Dashboard → **Authentication** → **Users**.
2. Locate the user who will become the owner.
3. Copy their **User UID** (UUID format: `xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`).

### 2. Insert the owner role assignment

1. Open Supabase Dashboard → **SQL Editor**.
2. Run the following statement (replace the UUID):

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<owner-uuid>', 'owner');
```

### 3. Verify

1. Have the owner log in to the application.
2. Navigate to `/dashboard/staff`.
3. Confirm the page loads successfully (HTTP 200) with the staff list visible.
4. Confirm that an admin or teacher user receives HTTP 403 on `/dashboard/staff`.

## Important Notes

- The `owner` role **cannot** be granted or revoked through the application UI or RPCs.
- The `grant_role` and `revoke_role` RPCs reject `'owner'` as a target role value.
- A partial unique index enforces that only one active owner assignment exists at any time.
- **Ownership transfer is out of scope.** There is no supported path (UI, RPC, or documented SQL) to transfer or revoke the owner role. If a future version requires ownership transfer, it must be designed, reviewed, and migrated as a separate change.

## Security Considerations

- Never use `service_role` keys in application code for role management.
- The application does not create, update, or delete Auth users.
- All role management RPCs use `SECURITY DEFINER` with `search_path = ''` and `auth.uid()` identity.
