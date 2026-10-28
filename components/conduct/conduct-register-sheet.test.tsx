// @vitest-environment jsdom

/**
 * ConductRegisterSheet — the Conducta page registers through a sheet opened
 * by one "Registrar" button, so the records list stays the page's main
 * surface and the form appears only on demand.
 */

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_MESSAGES,
  TOAST_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const TODAY = "2026-09-30";
const BETO_ID = "22222222-3333-4444-8555-666666666661";

const STUDENT_BETO = {
  id: BETO_ID,
  first_name: "Beto",
  surname: "Quito",
  national_id: "1712345679",
  pending_fines_count: 0,
  pending_fines_total: 0,
  warnings_count: 0,
};

const mocks = vi.hoisted(() => ({
  searchConductStudents: vi.fn(),
  createConductRecord: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/lib/domain/conduct", () => ({
  searchConductStudents: mocks.searchConductStudents,
  createConductRecord: mocks.createConductRecord,
  CONDUCT_KINDS: { FINE: "fine", WARNING: "warning" },
  MAX_FINE_AMOUNT: 99999999.99,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...(rest as Record<string, never>)}>
      {children}
    </a>
  ),
}));

import { ConductRegisterSheet } from "./conduct-register-sheet";

interface Rendered {
  unmount(): void;
}

function renderSheet(): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(<ConductRegisterSheet branchId={BRANCH_ID} todayDateOnly={TODAY} />);
  });

  return {
    unmount() {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

async function flush() {
  await act(async () => {});
  await act(async () => {});
}

function sheetContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="sheet-content"]');
}

function isSheetOpen(): boolean {
  const content = sheetContent();
  return content !== null && content.hasAttribute("data-open");
}

function triggerButton(): HTMLButtonElement {
  const button = [
    ...document.querySelectorAll<HTMLButtonElement>("button"),
  ].find((candidate) => candidate.textContent?.includes("Registrar"));
  if (!button) throw new Error("Registrar trigger not found");
  return button;
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
}

function setValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

async function openAndPickStudent() {
  click(triggerButton());
  await flush();

  const search = document.querySelector<HTMLInputElement>(
    "#conduct-student-search"
  );
  if (!search) throw new Error("sheet search input not found");

  mocks.searchConductStudents.mockResolvedValueOnce({
    success: true,
    data: { students: [STUDENT_BETO] },
  });
  setValue(search, "qui");
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await flush();

  const option = document.querySelector('[role="option"] button');
  if (!option) throw new Error("search option not found");
  click(option);
  await flush();
}

describe("ConductRegisterSheet", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    mocks.createConductRecord.mockResolvedValue({
      success: true,
      data: { id: "record-1" },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("keeps the form out of the page until the Registrar button opens the sheet", async () => {
    rendered = renderSheet();

    expect(isSheetOpen()).toBe(false);
    expect(document.querySelector("#conduct-student-search")).toBeNull();
    expect(triggerButton().textContent).toContain("Registrar");

    click(triggerButton());
    await flush();

    expect(isSheetOpen()).toBe(true);
    expect(sheetContent()?.textContent).toContain(CONDUCT_MESSAGES.CREATE_TITLE);
    expect(
      document.querySelector("#conduct-student-search")
    ).not.toBeNull();
  });

  it("registers the record from the sheet and closes it", async () => {
    rendered = renderSheet();
    await openAndPickStudent();

    setValue(
      document.querySelector<HTMLTextAreaElement>(
        '[data-slot="sheet-content"] textarea'
      )!,
      "Rompió una ventana"
    );
    setValue(
      document.querySelector<HTMLInputElement>(
        '[data-slot="sheet-content"] input[type="number"]'
      )!,
      "5"
    );

    const form = document.querySelector<HTMLFormElement>(
      '[data-slot="sheet-content"] form'
    );
    if (!form) throw new Error("sheet form not found");
    await act(async () => {
      form.dispatchEvent(
        new Event("submit", { bubbles: true, cancelable: true })
      );
    });
    await flush();

    expect(mocks.createConductRecord).toHaveBeenCalledWith({
      student_id: BETO_ID,
      branch_id: BRANCH_ID,
      kind: "fine",
      reason: "Rompió una ventana",
      incident_date: TODAY,
      amount: 5,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      TOAST_MESSAGES.CONDUCT_CREATED
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(isSheetOpen()).toBe(false);
  });
});
