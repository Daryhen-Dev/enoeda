/**
 * revokeBranchTeacher — unit tests (mock Supabase RPC).
 * Verifies: schema validation, RPC call shape, result typing, error mapping.
 */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";

vi.mock("server-only", () => ({}));
const mockRpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => ({ rpc: mockRpc })) }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: vi.fn() }));
vi.mock("@/lib/auth/identity-resolver", () => ({ getAuthenticatedContext: vi.fn() }));
vi.mock("@/lib/auth/server-context", () => ({ withAuthenticatedUser: vi.fn() }));

import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedContext } from "@/lib/auth/identity-resolver";
import { ROLE_CREATION_MESSAGES } from "@/lib/localization/es-ec";
import { createBranchAdmin, revokeBranchTeacher } from "./actions";

const BRANCH = "aaaaaaaa-1111-2222-8333-444444444444";
const TARGET = "bbbbbbbb-1111-2222-8333-444444444444";

describe("revokeBranchTeacher", () => {
  beforeEach(() => vi.clearAllMocks());

  it("rejects invalid input without calling RPC", async () => {
    expect((await revokeBranchTeacher({ targetUserId: "bad", branchId: BRANCH })).success).toBe(false);
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: "bad" })).success).toBe(false);
    expect(mockRpc).not.toHaveBeenCalled();
  });

  it("calls revoke_teacher_with_reassignment RPC and returns typed result", async () => {
    mockRpc.mockResolvedValue({ data: { status: "revoked", reassignedClassCount: 3, cutoff: "2026-08-28T10:00:00Z" }, error: null });
    const r = await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH });
    expect(mockRpc).toHaveBeenCalledWith("revoke_teacher_with_reassignment", { p_target_user_id: TARGET, p_branch_id: BRANCH });
    expect(r).toEqual({ success: true, data: { status: "revoked", reassignedClassCount: 3, cutoff: "2026-08-28T10:00:00Z" } });
  });

  it("returns blocked result variants", async () => {
    mockRpc.mockResolvedValue({ data: { status: "blocked", reason: "no_default_teacher" }, error: null });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).data).toEqual({ status: "blocked", reason: "no_default_teacher" });

    const conflicts = [{ classId: "c1", dayOfWeek: 1, startTime: "08:00:00" }];
    mockRpc.mockResolvedValue({ data: { status: "blocked", reason: "conflict", conflicts }, error: null });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).data).toEqual({ status: "blocked", reason: "conflict", conflicts });
  });

  it("maps RPC errors to user-facing messages", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "unauthorized: insufficient privileges" } });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).success).toBe(false);
    mockRpc.mockResolvedValue({ data: null, error: { message: "some_pg_error" } });
    expect((await revokeBranchTeacher({ targetUserId: TARGET, branchId: BRANCH })).success).toBe(false);
  });
});

// --- createBranchAdmin helpers -------------------------------------------------

const NEW_ADMIN_USER_ID = "cccccccc-1111-2222-8333-444444444444";

type QueryResult = { data: unknown; error: unknown };

interface TableQueryBuilder extends PromiseLike<QueryResult> {
  select: Mock;
  eq: Mock;
  is: Mock;
  insert: Mock;
  maybeSingle: Mock;
}

/** Chainable Supabase query builder stub resolving to a fixed result on await. */
function createTableQuery(result: QueryResult): TableQueryBuilder {
  const builder = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    insert: vi.fn(),
    maybeSingle: vi.fn(),
    then: (
      onFulfilled?: ((value: QueryResult) => unknown) | null,
      onRejected?: ((reason: unknown) => unknown) | null
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
  };
  for (const method of ["select", "eq", "is", "insert", "maybeSingle"] as const) {
    builder[method].mockImplementation(() => builder);
  }
  return builder as unknown as TableQueryBuilder;
}

interface AdminClientStub {
  auth: {
    admin: {
      createUser: Mock;
      listUsers: Mock;
      deleteUser: Mock;
    };
  };
  from: Mock;
}

function buildAdminClient(config?: {
  listUsersPages?: QueryResult[];
  createUser?: QueryResult;
  tables?: Record<string, QueryResult>;
}) {
  const builders = new Map<string, TableQueryBuilder>();
  const admin: AdminClientStub = {
    auth: {
      admin: {
        createUser: vi.fn(async () =>
          config?.createUser ?? { data: { user: { id: NEW_ADMIN_USER_ID } }, error: null }
        ),
        listUsers: vi.fn(async (params: { page: number; perPage: number }) =>
          config?.listUsersPages?.[params.page - 1] ?? { data: { users: [] }, error: null }
        ),
        deleteUser: vi.fn(async () => ({ data: null, error: null })),
      },
    },
    from: vi.fn((table: string) => {
      let builder = builders.get(table);
      if (!builder) {
        builder = createTableQuery(config?.tables?.[table] ?? { data: null, error: null });
        builders.set(table, builder);
      }
      return builder;
    }),
  };
  return { admin, builders };
}

function useAdminClient(admin: AdminClientStub) {
  vi.mocked(createAdminClient).mockReturnValue(
    admin as unknown as ReturnType<typeof createAdminClient>
  );
}

function identityContext(ctx: unknown) {
  return ctx as unknown as Awaited<ReturnType<typeof getAuthenticatedContext>>;
}

const OWNER_IDENTITY = identityContext({
  ok: true,
  ctx: { userId: "owner-1", roles: ["owner"], assignments: [] },
});
const ADMIN_IDENTITY = identityContext({
  ok: true,
  ctx: { userId: "admin-1", roles: ["admin"], assignments: [] },
});
const UNAUTHENTICATED_IDENTITY = identityContext({ ok: false });

const ADMIN_INPUT = {
  email: "nueva.admin@example.com",
  branchId: BRANCH,
  first_name: "María",
  surname: "Pérez",
  phone: "0999999999",
  date_of_birth: "1990-05-10",
};

describe("createBranchAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAuthenticatedContext).mockResolvedValue(OWNER_IDENTITY);
  });

  it("creates a new account when no auth user matches the email", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { admin, builders } = buildAdminClient({
      listUsersPages: [
        { data: { users: [{ id: "u-other", email: "otro@example.com" }] }, error: null },
      ],
      tables: { user_profiles: { data: null, error: null } },
    });
    useAdminClient(admin);

    const result = await createBranchAdmin(ADMIN_INPUT);

    expect(admin.auth.admin.listUsers).toHaveBeenCalledWith({ page: 1, perPage: 1000 });
    expect(admin.auth.admin.createUser).toHaveBeenCalledTimes(1);
    expect(admin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({
        email: ADMIN_INPUT.email,
        email_confirm: true,
        app_metadata: { must_change_password: true },
        password: expect.any(String),
      })
    );
    expect(mockRpc).toHaveBeenCalledWith("assign_branch_admin", {
      p_target: NEW_ADMIN_USER_ID,
      p_branch_id: BRANCH,
    });
    expect(builders.get("user_profiles")?.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: NEW_ADMIN_USER_ID,
        first_name: ADMIN_INPUT.first_name,
        surname: ADMIN_INPUT.surname,
        phone: ADMIN_INPUT.phone,
        date_of_birth: ADMIN_INPUT.date_of_birth,
      })
    );
    expect(result).toEqual({
      success: true,
      data: {
        mode: "created",
        email: ADMIN_INPUT.email,
        temporaryPassword: expect.any(String),
      },
    });
  });

  it("reuses an existing account without creating a new one and inserts the missing profile", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const { admin, builders } = buildAdminClient({
      // Padded, mixed-case email proves the trimmed/lowercase comparison.
      listUsersPages: [
        { data: { users: [{ id: TARGET, email: "  Nueva.Admin@Example.COM " }] }, error: null },
      ],
      tables: {
        user_roles: { data: null, error: null },
        user_profiles: { data: null, error: null },
      },
    });
    useAdminClient(admin);

    const result = await createBranchAdmin(ADMIN_INPUT);

    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mockRpc).toHaveBeenCalledWith("assign_branch_admin", {
      p_target: TARGET,
      p_branch_id: BRANCH,
    });
    expect(builders.get("user_profiles")?.insert).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      success: true,
      data: { mode: "existing", email: ADMIN_INPUT.email },
    });
    if (result.success && result.data) {
      expect("temporaryPassword" in result.data).toBe(false);
    }
  });

  it("fails without assigning when the existing account already administers the branch", async () => {
    const { admin } = buildAdminClient({
      listUsersPages: [
        { data: { users: [{ id: TARGET, email: ADMIN_INPUT.email }] }, error: null },
      ],
      tables: {
        user_roles: { data: { user_id: TARGET }, error: null },
        user_profiles: { data: null, error: null },
      },
    });
    useAdminClient(admin);

    const result = await createBranchAdmin(ADMIN_INPUT);

    expect(result).toEqual({
      success: false,
      error: ROLE_CREATION_MESSAGES.ALREADY_ADMIN_IN_BRANCH,
    });
    expect(mockRpc).not.toHaveBeenCalled();
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalledWith("user_profiles");
  });

  it("paginates the auth listing and leaves an existing profile untouched", async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    const fullPage = Array.from({ length: 1000 }, (_, index) => ({
      id: `u-${index}`,
      email: `usuario${index}@example.com`,
    }));
    const { admin, builders } = buildAdminClient({
      listUsersPages: [
        { data: { users: fullPage }, error: null },
        { data: { users: [{ id: TARGET, email: ADMIN_INPUT.email }] }, error: null },
      ],
      tables: {
        user_roles: { data: null, error: null },
        user_profiles: { data: { user_id: TARGET }, error: null },
      },
    });
    useAdminClient(admin);

    const result = await createBranchAdmin(ADMIN_INPUT);

    expect(admin.auth.admin.listUsers).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      success: true,
      data: { mode: "existing", email: ADMIN_INPUT.email },
    });
    expect(builders.get("user_profiles")?.insert).not.toHaveBeenCalled();
  });

  it("short-circuits on schema, authentication, or permission failure", async () => {
    const { admin, builders } = buildAdminClient();
    useAdminClient(admin);

    expect((await createBranchAdmin({ ...ADMIN_INPUT, email: "no-valido" })).success).toBe(false);

    vi.mocked(getAuthenticatedContext).mockResolvedValue(UNAUTHENTICATED_IDENTITY);
    expect((await createBranchAdmin(ADMIN_INPUT)).success).toBe(false);

    vi.mocked(getAuthenticatedContext).mockResolvedValue(ADMIN_IDENTITY);
    expect((await createBranchAdmin(ADMIN_INPUT)).success).toBe(false);

    expect(mockRpc).not.toHaveBeenCalled();
    expect(admin.auth.admin.listUsers).not.toHaveBeenCalled();
    expect(admin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(admin.from).not.toHaveBeenCalled();
    expect(builders.size).toBe(0);
  });
});
