// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PUBLIC_STUDENT_REGISTRATION_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";

const mocks = vi.hoisted(() => ({
  fetch: vi.fn(),
  refresh: vi.fn(),
  replace: vi.fn(),
  signInWithPassword: vi.fn(),
}));

vi.mock("altcha", () => ({}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh, replace: mocks.replace }),
}));
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithPassword: mocks.signInWithPassword },
  }),
}));

import { PublicStudentRegistrationForm } from "./public-student-registration-form";

interface RenderedForm {
  container: HTMLDivElement;
  unmount(): void;
}

function renderForm(): RenderedForm {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <PublicStudentRegistrationForm
        branches={[{ id: BRANCH_ID, name: "Centro" }]}
      />
    );
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

async function waitForAltcha() {
  await act(async () => {
    await new Promise((resolve) => window.setTimeout(resolve, 0));
  });
}

function setInputValue(container: HTMLDivElement, id: string, value: string) {
  const input = container.querySelector<HTMLInputElement>(`#${id}`);
  if (!input) {
    throw new Error(`Missing input: ${id}`);
  }
  input.value = value;
}

async function submit(rendered: RenderedForm) {
  const branch = rendered.container.querySelector<HTMLSelectElement>(
    "#public-registration-branch"
  );
  if (!branch) {
    throw new Error("Missing branch selector.");
  }

  branch.value = BRANCH_ID;
  setInputValue(rendered.container, "public-registration-first-name", "Ada");
  setInputValue(rendered.container, "public-registration-surname", "Lovelace");
  setInputValue(rendered.container, "public-registration-national-id", "0102030405");
  setInputValue(rendered.container, "public-registration-date-of-birth", "2000-01-01");
  setInputValue(rendered.container, "public-registration-email", "Student@Example.com");
  setInputValue(rendered.container, "public-registration-password", "correct-password");
  setInputValue(rendered.container, "public-registration-phone", "0999999999");

  const form = rendered.container.querySelector("form");
  await act(async () => {
    form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
  });
}

describe("PublicStudentRegistrationForm", () => {
  let rendered: RenderedForm | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mocks.fetch);
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: { id: "student-id" } },
      error: null,
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("renders every required registration field and the configured ALTCHA widget", async () => {
    rendered = renderForm();
    await waitForAltcha();

    const altcha = rendered.container.querySelector("altcha-widget");
    const password = rendered.container.querySelector<HTMLInputElement>(
      "#public-registration-password"
    );
    const phone = rendered.container.querySelector<HTMLInputElement>(
      "#public-registration-phone"
    );

    expect(altcha?.getAttribute("challenge")).toBe("/api/public/altcha/challenge");
    expect(altcha?.getAttribute("name")).toBe("altcha");
    expect(password?.required).toBe(true);
    expect(password?.minLength).toBe(8);
    expect(phone?.required).toBe(true);
  });

  it("shows the server CAPTCHA error without attempting browser sign-in", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ error: PUBLIC_STUDENT_REGISTRATION_MESSAGES.CAPTCHA_FAILURE }), {
        headers: { "content-type": "application/json" },
        status: 403,
      })
    );
    rendered = renderForm();
    await waitForAltcha();

    await submit(rendered);

    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain(
      PUBLIC_STUDENT_REGISTRATION_MESSAGES.CAPTCHA_FAILURE
    );
  });

  it("posts FormData, then signs in and redirects only after registration succeeds", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ studentId: "student-id" }), {
        headers: { "content-type": "application/json" },
        status: 201,
      })
    );
    rendered = renderForm();
    await waitForAltcha();

    await submit(rendered);

    const [url, options] = mocks.fetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/public/student-registration");
    expect(options.method).toBe("POST");
    expect(options.headers).toBeUndefined();
    expect(options.body).toBeInstanceOf(FormData);
    expect((options.body as FormData).get("branch_id")).toBe(BRANCH_ID);
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({
      email: "student@example.com",
      password: "correct-password",
    });
    expect(mocks.replace).toHaveBeenCalledWith("/student");
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it("does not repeat registration when post-registration sign-in fails", async () => {
    mocks.fetch.mockResolvedValue(
      new Response(JSON.stringify({ studentId: "student-id" }), {
        headers: { "content-type": "application/json" },
        status: 201,
      })
    );
    mocks.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: "sign in failed" },
    });
    rendered = renderForm();
    await waitForAltcha();

    await submit(rendered);

    expect(mocks.fetch).toHaveBeenCalledTimes(1);
    expect(mocks.replace).not.toHaveBeenCalled();
    expect(rendered.container.querySelector('[role="alert"]')?.textContent).toContain(
      PUBLIC_STUDENT_REGISTRATION_MESSAGES.SIGN_IN_FAILURE
    );
  });
});
