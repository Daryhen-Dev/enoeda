// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  refresh: vi.fn(),
  updateOwnStudentPhone: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: vi.fn() },
}));
vi.mock("@/lib/domain/student-enrollment", () => ({
  updateOwnStudentPhone: mocks.updateOwnStudentPhone,
}));

import { StudentPhoneForm } from "./student-phone-form";

interface RenderedForm {
  container: HTMLDivElement;
  unmount(): void;
}

function renderForm(isActive: boolean): RenderedForm {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<StudentPhoneForm isActive={isActive} phone="0999999999" />);
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

describe("StudentPhoneForm", () => {
  let rendered: RenderedForm | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("keeps inactive students read-only and does not render the update control", () => {
    rendered = renderForm(false);

    const phone = rendered.container.querySelector<HTMLInputElement>(
      "#student-profile-phone"
    );
    expect(phone?.disabled).toBe(true);
    expect(rendered.container.textContent).not.toContain("Actualizar teléfono");
  });

  it("permits an active student to submit only the phone value", async () => {
    mocks.updateOwnStudentPhone.mockResolvedValue({
      data: { id: "student-id" },
      success: true,
    });
    rendered = renderForm(true);

    const form = rendered.container.querySelector("form");
    await act(async () => {
      form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });

    expect(mocks.updateOwnStudentPhone).toHaveBeenCalledWith({ phone: "0999999999" });
    expect(mocks.refresh).toHaveBeenCalled();
  });
});
