// @vitest-environment jsdom

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_MESSAGES,
  CONDUCT_QUICK_ENTRY_MESSAGES,
  TOAST_MESSAGES,
  formatCurrency,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const TODAY = "2026-09-30";
const BETO_ID = "22222222-3333-4444-8555-666666666661";
const ANA_ID = "22222222-3333-4444-8555-666666666662";

const STUDENT_BETO = {
  id: BETO_ID,
  first_name: "Beto",
  surname: "Quito",
  national_id: "1712345679",
  pending_fines_count: 2,
  pending_fines_total: 10,
  warnings_count: 1,
};

const STUDENT_ANA = {
  id: ANA_ID,
  first_name: "Ana",
  surname: "Zapata",
  national_id: "1712345678",
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
  default: ({
    href,
    children,
  }: {
    href: string;
    children?: ReactNode;
  }) => <a href={href}>{children}</a>,
}));

import { ConductQuickEntry, summarizeConductCounters } from "./conduct-quick-entry";

interface RenderedEntry {
  unmount(): void;
}

function renderEntry(): RenderedEntry {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ConductQuickEntry branchId={BRANCH_ID} todayDateOnly={TODAY} />
    );
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

function setValue(
  element: HTMLInputElement | HTMLTextAreaElement,
  value: string
) {
  const proto =
    element instanceof HTMLTextAreaElement
      ? HTMLTextAreaElement.prototype
      : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")!.set!;
  setter.call(element, value);
  element.dispatchEvent(new Event("input", { bubbles: true }));
}

function setSearch(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    "#conduct-student-search"
  );
  if (!input) throw new Error("search input not found");
  act(() => {
    setValue(input, value);
  });
}

function pressKey(element: Element, key: string) {
  act(() => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
}

function submitForm() {
  const form = document.querySelector("form");
  if (!form) throw new Error("form not found");
  act(() => {
    form.dispatchEvent(
      new Event("submit", { bubbles: true, cancelable: true })
    );
  });
}

function clickButtonWithText(text: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.includes(text)
  );
  if (!button) throw new Error(`button "${text}" not found`);
  act(() => {
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
}

function querySearchInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    "#conduct-student-search"
  );
  if (!input) throw new Error("search input not found");
  return input;
}

async function searchAndWait(query: string, results: unknown[]) {
  mocks.searchConductStudents.mockResolvedValueOnce({
    success: true,
    data: { students: results },
  });
  setSearch(query);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await flush();
}

describe("ConductQuickEntry", () => {
  let rendered: RenderedEntry | undefined;

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

  it("autofocuses the search input and debounces the student search", async () => {
    mocks.searchConductStudents.mockResolvedValue({
      success: true,
      data: { students: [] },
    });
    rendered = renderEntry();

    expect(document.activeElement).toBe(querySearchInput());

    setSearch("an");
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(mocks.searchConductStudents).not.toHaveBeenCalled();

    setSearch("ana");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();

    expect(mocks.searchConductStudents).toHaveBeenCalledTimes(1);
    expect(mocks.searchConductStudents).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      query: "ana",
    });
  });

  it("ignores stale search results via the sequence guard", async () => {
    const resolvers: Array<(value: unknown) => void> = [];
    mocks.searchConductStudents.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvers.push(resolve);
        })
    );
    rendered = renderEntry();

    setSearch("an");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    setSearch("ana");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();

    expect(resolvers.length).toBe(2);
    // The latest query resolves first with Beto...
    resolvers[1]({
      success: true,
      data: { students: [STUDENT_BETO] },
    });
    await flush();
    expect(document.body.textContent).toContain("Quito Beto");

    // ...then the stale query resolves late with Ana and must not win.
    resolvers[0]({
      success: true,
      data: { students: [STUDENT_ANA] },
    });
    await flush();
    expect(document.body.textContent).toContain("Quito Beto");
    expect(document.body.textContent).not.toContain("Zapata Ana");
  });

  it("shows the no-results and error search states", async () => {
    rendered = renderEntry();

    mocks.searchConductStudents.mockResolvedValueOnce({
      success: true,
      data: { students: [] },
    });
    setSearch("zzz");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    expect(document.body.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_NO_RESULTS("zzz")
    );

    mocks.searchConductStudents.mockResolvedValueOnce({
      success: false,
      error: "boom",
    });
    setSearch("yyy");
    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.SEARCH_ERROR
    );
  });

  it("picks a student with the keyboard and shows the selected card", async () => {
    rendered = renderEntry();
    await searchAndWait("qui", [STUDENT_BETO]);

    const listbox = document.querySelector('[role="listbox"]');
    expect(listbox).not.toBeNull();
    const options = document.querySelectorAll('[role="option"]');
    expect(options.length).toBe(1);
    expect(options[0].textContent).toContain("Quito Beto");
    expect(options[0].textContent).toContain("1712345679");
    expect(options[0].textContent).toContain(
      summarizeConductCounters(STUDENT_BETO)
    );
    expect(summarizeConductCounters(STUDENT_BETO)).toBe(
      `${CONDUCT_MESSAGES.SUMMARY_PENDING_FINES(2, formatCurrency(10))} · ${CONDUCT_MESSAGES.SUMMARY_WARNINGS(1)}`
    );

    pressKey(querySearchInput(), "ArrowDown");
    expect(querySearchInput().getAttribute("aria-activedescendant")).toBe(
      options[0].id
    );
    pressKey(querySearchInput(), "Enter");
    await flush();

    // The card replaces the listbox.
    expect(document.querySelector('[role="listbox"]')).toBeNull();
    expect(document.body.textContent).toContain("Quito Beto");
    expect(document.body.textContent).toContain("1712345679");

    const profileLink = document.querySelector<HTMLAnchorElement>(
      `a[href="/dashboard/students/${BETO_ID}?branch=${BRANCH_ID}"]`
    );
    expect(profileLink?.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.VIEW_PROFILE
    );
    expect(
      [...document.querySelectorAll("button")].some((button) =>
        button.textContent?.includes(CONDUCT_QUICK_ENTRY_MESSAGES.CHANGE_STUDENT)
      )
    ).toBe(true);
  });

  it("clears the search with Escape", async () => {
    rendered = renderEntry();
    await searchAndWait("qui", [STUDENT_BETO]);

    pressKey(querySearchInput(), "Escape");
    await flush();

    expect(querySearchInput().value).toBe("");
    expect(document.querySelector('[role="listbox"]')).toBeNull();
  });

  it("submits a fine, then resets, keeps the kind and refocuses the search input", async () => {
    rendered = renderEntry();
    await searchAndWait("qui", [STUDENT_BETO]);
    pressKey(querySearchInput(), "ArrowDown");
    pressKey(querySearchInput(), "Enter");
    await flush();

    setValue(
      document.querySelector<HTMLTextAreaElement>("textarea")!,
      "Rompió una ventana"
    );
    setValue(
      document.querySelector<HTMLInputElement>('input[type="number"]')!,
      "5"
    );
    submitForm();
    await flush();

    expect(mocks.createConductRecord).toHaveBeenCalledTimes(1);
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

    // Ready for the next entry: selection cleared, form unmounted, search
    // focused and empty.
    expect(document.activeElement).toBe(querySearchInput());
    expect(querySearchInput().value).toBe("");
    expect(document.body.textContent).not.toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.VIEW_PROFILE
    );
    expect(document.querySelector("textarea")).toBeNull();

    // Picking the next student keeps the chosen kind (fine): the amount
    // field reappears without touching the toggle.
    await searchAndWait("qui", [STUDENT_BETO]);
    pressKey(querySearchInput(), "ArrowDown");
    pressKey(querySearchInput(), "Enter");
    await flush();
    expect(
      document.querySelector<HTMLInputElement>('input[type="number"]')
    ).not.toBeNull();
  });

  it("hides the amount field for a warning and keeps the kind after success", async () => {
    rendered = renderEntry();
    await searchAndWait("qui", [STUDENT_BETO]);
    pressKey(querySearchInput(), "ArrowDown");
    pressKey(querySearchInput(), "Enter");
    await flush();

    clickButtonWithText(CONDUCT_MESSAGES.KIND_WARNING);
    await flush();
    expect(
      document.querySelector<HTMLInputElement>('input[type="number"]')
    ).toBeNull();

    setValue(
      document.querySelector<HTMLTextAreaElement>("textarea")!,
      "Interrumpió la clase"
    );
    submitForm();
    await flush();

    const call = mocks.createConductRecord.mock.calls[0][0];
    expect(call).toEqual({
      student_id: BETO_ID,
      branch_id: BRANCH_ID,
      kind: "warning",
      reason: "Interrumpió la clase",
      incident_date: TODAY,
    });
    expect(call).not.toHaveProperty("amount");
    expect(mocks.refresh).toHaveBeenCalled();

    // Picking the next student keeps the chosen kind (warning): still no
    // amount field.
    await searchAndWait("qui", [STUDENT_BETO]);
    pressKey(querySearchInput(), "ArrowDown");
    pressKey(querySearchInput(), "Enter");
    await flush();
    expect(
      document.querySelector<HTMLInputElement>('input[type="number"]')
    ).toBeNull();
  });
});
