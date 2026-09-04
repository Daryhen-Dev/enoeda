// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SafeRedirect } from "@/lib/auth/redirect";
import { AUTH_MESSAGES } from "@/lib/localization/es-ec";

const USER_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  rpc: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
    from: mocks.from,
    rpc: mocks.rpc,
  }),
}));

import { LoginForm } from "./login-form";

interface RenderedLoginForm {
  container: HTMLDivElement;
  unmount(): void;
}

function renderLoginForm(): RenderedLoginForm {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<LoginForm redirectTo={"/dashboard" as SafeRedirect} />);
  });

  return {
    container,
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

function studentQuery(
  student: { id: string } | null,
  error: { message: string } | null = null
) {
  const result = {
    eq: vi.fn(),
    maybeSingle: vi.fn(),
    select: vi.fn(),
  };
  result.select.mockReturnValue(result);
  result.eq.mockReturnValue(result);
  result.maybeSingle.mockResolvedValue({ data: student, error });
  return result;
}

describe("LoginForm destinations", () => {
  let rendered: RenderedLoginForm | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: USER_ID } },
      error: null,
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  async function submit() {
    const form = rendered?.container.querySelector("form");
    const email = rendered?.container.querySelector<HTMLInputElement>("#email");
    const password = rendered?.container.querySelector<HTMLInputElement>("#password");
    if (email) email.value = "student@example.com";
    if (password) password.value = "correct-password";

    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
  }

  it("preserves staff routing for users with operational roles", async () => {
    mocks.rpc.mockResolvedValue({
      data: [{ branch_id: USER_ID, role: "admin" }],
      error: null,
    });
    rendered = renderLoginForm();

    await submit();

    expect(mocks.replace).toHaveBeenCalledWith("/dashboard");
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it("sends a linked role-less student to the dedicated student area", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    const query = studentQuery({ id: "student-id" });
    mocks.from.mockReturnValue(query);
    rendered = renderLoginForm();

    await submit();

    expect(query.eq).toHaveBeenCalledWith("auth_user_id", USER_ID);
    expect(mocks.replace).toHaveBeenCalledWith("/student");
  });

  it("sends a role-less invited account to enrollment when no student is linked", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(studentQuery(null));
    rendered = renderLoginForm();

    await submit();

    expect(mocks.replace).toHaveBeenCalledWith("/enroll");
  });

  it("does not misroute a user when role resolution fails", async () => {
    mocks.rpc.mockResolvedValue({
      data: null,
      error: { message: "role lookup failed" },
    });
    rendered = renderLoginForm();

    await submit();

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(mocks.from).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
      AUTH_MESSAGES.LOGIN_FAILURE
    );
  });

  it("does not misroute a role-less user when student resolution fails", async () => {
    mocks.rpc.mockResolvedValue({ data: [], error: null });
    mocks.from.mockReturnValue(
      studentQuery(null, { message: "student lookup failed" })
    );
    rendered = renderLoginForm();

    await submit();

    expect(mocks.replace).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toBe(
      AUTH_MESSAGES.LOGIN_FAILURE
    );
  });
});
