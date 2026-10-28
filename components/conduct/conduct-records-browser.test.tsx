// @vitest-environment jsdom

/**
 * ConductRecordsBrowser — the Conducta page's records list and its "Alumno"
 * filter. The list leads; the search narrows it to one student; clearing the
 * search returns to the branch's latest records.
 */

import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  CONDUCT_QUICK_ENTRY_MESSAGES,
  CONDUCT_RECORDS_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const BETO_ID = "22222222-3333-4444-8555-666666666661";
const ANA_ID = "22222222-3333-4444-8555-666666666662";

const STUDENT_BETO = {
  id: BETO_ID,
  first_name: "Beto",
  surname: "Quito",
  national_id: "1712345679",
  pending_fines_count: 0,
  pending_fines_total: 0,
  warnings_count: 1,
};

const BRANCH_RECORD = {
  id: "record-branch",
  student_id: ANA_ID,
  student: { id: ANA_ID, first_name: "Ana", surname: "Zapata" },
  kind: "fine",
  reason: "Llegó tarde repetidamente",
  incident_date: new Date("2026-09-20T00:00:00.000Z"),
  amount: 5,
  status: "pending",
  paid_at: null,
  paid_by: null,
  voided_at: null,
  voided_by: null,
  void_reason: null,
  created_by: "user-1",
  created_at: new Date("2026-09-21T12:00:00.000Z"),
  updated_at: new Date("2026-09-21T12:00:00.000Z"),
};

const BETO_RECORD = {
  ...BRANCH_RECORD,
  id: "record-beto",
  student_id: BETO_ID,
  student: { id: BETO_ID, first_name: "Beto", surname: "Quito" },
  kind: "warning",
  reason: "Interrumpió la clase",
  amount: null,
  status: "issued",
};

const mocks = vi.hoisted(() => ({
  searchConductStudents: vi.fn(),
  listBranchConductRecords: vi.fn(),
}));

vi.mock("@/lib/domain/conduct", () => ({
  searchConductStudents: mocks.searchConductStudents,
  listBranchConductRecords: mocks.listBranchConductRecords,
  CONDUCT_KINDS: { FINE: "fine", WARNING: "warning" },
  CONDUCT_STATUSES: { PENDING: "pending", PAID: "paid", ISSUED: "issued" },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children?: ReactNode } & Record<string, unknown>) => (
    <a href={href} {...(rest as Record<string, never>)}>
      {children}
    </a>
  ),
}));

import { ConductRecordsBrowser } from "./conduct-records-browser";
import { notifyConductRecordCreated } from "./conduct-events";

interface Rendered {
  unmount(): void;
}

function renderBrowser(
  initialRecords: Array<typeof BRANCH_RECORD> = [BRANCH_RECORD]
): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <ConductRecordsBrowser
        branchId={BRANCH_ID}
        initialRecords={initialRecords}
      />
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

function queryFilterInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>(
    "#conduct-record-filter"
  );
  if (!input) throw new Error("filter input not found");
  return input;
}

function setFilter(value: string) {
  const input = queryFilterInput();
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )!.set!;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true })
    );
  });
}

function clickButtonWithText(text: string) {
  const button = [...document.querySelectorAll<HTMLButtonElement>("button")].find(
    (candidate) => candidate.textContent?.includes(text)
  );
  if (!button) throw new Error(`button "${text}" not found`);
  click(button);
}

/** Types in the filter, waits out the debounce and picks the first match. */
async function filterByStudent(query: string) {
  mocks.searchConductStudents.mockResolvedValueOnce({
    success: true,
    data: { students: [STUDENT_BETO] },
  });
  setFilter(query);
  await act(async () => {
    vi.advanceTimersByTime(300);
  });
  await flush();

  const option = document.querySelector('[role="option"] button');
  if (!option) throw new Error("search option not found");
  click(option);
  await flush();
}

describe("ConductRecordsBrowser", () => {
  let rendered: Rendered | undefined;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    vi.useFakeTimers({
      toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval"],
    });
    mocks.searchConductStudents.mockResolvedValue({
      success: true,
      data: { students: [] },
    });
    mocks.listBranchConductRecords.mockResolvedValue({
      success: true,
      data: { records: [] },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("leads with the branch's latest records and no filter applied", () => {
    rendered = renderBrowser();

    expect(document.body.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_TITLE
    );
    expect(document.body.textContent).toContain("Llegó tarde repetidamente");
    expect(document.body.textContent).toContain("Zapata Ana");
    // Filter is offered but inactive.
    expect(queryFilterInput().value).toBe("");
    expect(
      [...document.querySelectorAll("button")].some((button) =>
        button.textContent?.includes(CONDUCT_RECORDS_MESSAGES.FILTER_CLEAR)
      )
    ).toBe(false);
  });

  it("debounces the student search before filtering", async () => {
    rendered = renderBrowser();

    setFilter("qui");
    await act(async () => {
      vi.advanceTimersByTime(299);
    });
    expect(mocks.searchConductStudents).not.toHaveBeenCalled();

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await flush();
    expect(mocks.searchConductStudents).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      query: "qui",
    });
  });

  it("filters the list to the picked student and names the section after them", async () => {
    mocks.listBranchConductRecords.mockResolvedValueOnce({
      success: true,
      data: { records: [BETO_RECORD] },
    });
    rendered = renderBrowser();

    await filterByStudent("qui");

    expect(mocks.listBranchConductRecords).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      student_id: BETO_ID,
    });
    // Only the picked student's records remain, under their own heading.
    expect(document.body.textContent).toContain(
      CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_TITLE("Quito Beto")
    );
    expect(document.body.textContent).not.toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_TITLE
    );
    expect(document.body.textContent).toContain("Interrumpió la clase");
    expect(document.body.textContent).not.toContain(
      "Llegó tarde repetidamente"
    );
    expect(
      document.querySelector(
        `a[href="/dashboard/students/${BETO_ID}?branch=${BRANCH_ID}"]`
      )
    ).not.toBeNull();
  });

  it("clears the filter and restores the branch's latest records", async () => {
    mocks.listBranchConductRecords.mockResolvedValueOnce({
      success: true,
      data: { records: [BETO_RECORD] },
    });
    rendered = renderBrowser();
    await filterByStudent("qui");

    clickButtonWithText(CONDUCT_RECORDS_MESSAGES.FILTER_CLEAR);
    await flush();

    expect(document.body.textContent).toContain(
      CONDUCT_QUICK_ENTRY_MESSAGES.RECENT_TITLE
    );
    expect(document.body.textContent).toContain("Llegó tarde repetidamente");
    expect(document.body.textContent).not.toContain(
      CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_TITLE("Quito Beto")
    );
    expect(queryFilterInput().value).toBe("");
  });

  it("shows the student's empty state when they have no records", async () => {
    mocks.listBranchConductRecords.mockResolvedValueOnce({
      success: true,
      data: { records: [] },
    });
    rendered = renderBrowser();

    await filterByStudent("qui");

    expect(document.body.textContent).toContain(
      CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_EMPTY
    );
    expect(document.body.textContent).not.toContain("Llegó tarde repetidamente");
  });

  it("shows an error state when the student's records cannot be loaded", async () => {
    mocks.listBranchConductRecords.mockResolvedValueOnce({
      success: false,
      error: "boom",
    });
    rendered = renderBrowser();

    await filterByStudent("qui");

    const alert = document.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_LOAD_FAILURE
    );
    expect(document.body.textContent).toContain(
      CONDUCT_RECORDS_MESSAGES.STUDENT_RECORDS_TITLE("Quito Beto")
    );
  });

  it("reloads the filtered student's records after a record is created", async () => {
    // Registering from the sheet must be visible under an active filter; the
    // server refresh only updates the unfiltered branch list.
    mocks.listBranchConductRecords.mockResolvedValue({
      success: true,
      data: { records: [BETO_RECORD] },
    });
    rendered = renderBrowser();

    await filterByStudent("qui");
    expect(mocks.listBranchConductRecords).toHaveBeenCalledTimes(1);

    act(() => {
      notifyConductRecordCreated();
    });
    await flush();

    expect(mocks.listBranchConductRecords).toHaveBeenCalledTimes(2);
    expect(mocks.listBranchConductRecords).toHaveBeenLastCalledWith({
      branch_id: BRANCH_ID,
      student_id: BETO_ID,
    });
  });
});
