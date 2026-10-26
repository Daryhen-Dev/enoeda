// @vitest-environment jsdom

/**
 * StudentSearchPalette — S1 contract.
 *
 * Ctrl/Cmd+K opens a search over the students of the active branch, the arrow
 * keys move the highlight, Enter opens the highlighted student keeping the
 * branch, and Escape closes without navigating. A failed search never closes
 * the palette.
 */

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  STUDENT_DIRECTORY_MESSAGES,
  STUDENT_SEARCH_MESSAGES,
} from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const STUDENT_A = "cccccccc-1111-4222-8333-444444444444";
const STUDENT_B = "cccccccc-2222-4222-8333-444444444445";

const mocks = vi.hoisted(() => ({
  listStudents: vi.fn(),
  push: vi.fn(),
}));

vi.mock("@/lib/domain/students", () => ({
  listStudents: mocks.listStudents,
  STUDENT_STATUS: { ACTIVE: "active", INACTIVE: "inactive" },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push }),
  useSearchParams: () => new URLSearchParams(`branch=${BRANCH_ID}`),
}));

import { StudentSearchPalette } from "./student-search-palette";

interface Rendered {
  container: HTMLDivElement;
  unmount(): void;
}

function makeStudent(id: string, first: string, surname: string) {
  return {
    id,
    branch_id: BRANCH_ID,
    first_name: first,
    surname,
    national_id: "1712345678",
    email: null,
    date_of_birth: null,
    activation_status: "active",
    active_discipline_names: ["Karate"],
    active_disciplines: [],
  };
}

const STUDENT_CATALOG = [
  makeStudent(STUDENT_A, "Ana", "Pérez"),
  makeStudent(STUDENT_B, "Bruno", "Díaz"),
];

/**
 * Every search returns the same two students regardless of status; the palette
 * merges the active and inactive queries and slices the result.
 */
function searchReturns(items: ReturnType<typeof makeStudent>[]) {
  mocks.listStudents.mockResolvedValue({
    success: true,
    data: { items, next_cursor: null },
  });
}

function renderPalette(
  props: { isAdmin?: boolean; canManageProfile?: boolean; isTeacherOnly?: boolean } = {}
): Rendered {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  act(() => {
    root.render(<StudentSearchPalette {...props} />);
  });
  return {
    container,
    unmount() {
      act(() => root.unmount());
      container.remove();
    },
  };
}

function paletteContent(): HTMLElement | null {
  return document.querySelector<HTMLElement>('[data-slot="dialog-content"]');
}

function searchInput(): HTMLInputElement | null {
  return document.querySelector<HTMLInputElement>(
    `input[placeholder="${STUDENT_SEARCH_MESSAGES.INPUT_PLACEHOLDER}"]`
  );
}

function typeInto(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(
    HTMLInputElement.prototype,
    "value"
  )!.set!;
  setter.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

async function flushSearch() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(STUDENT_SEARCH_MESSAGES_DEBOUNCE);
  });
}

/** Mirrors the debounce the component documents; kept in one place here. */
const STUDENT_SEARCH_MESSAGES_DEBOUNCE = 250;

function pressKey(key: string, target: HTMLElement | Window = window) {
  act(() => {
    target.dispatchEvent(
      new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    );
  });
}

let rendered: Rendered | null = null;

beforeEach(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  vi.clearAllMocks();
  searchReturns(STUDENT_CATALOG);
});

afterEach(() => {
  rendered?.unmount();
  rendered = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("StudentSearchPalette opening", () => {
  it("opens with Ctrl+K", () => {
    rendered = renderPalette();
    expect(paletteContent()).toBeNull();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "k",
          ctrlKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(paletteContent()).not.toBeNull();
  });

  it("opens with Command+K on a Mac keyboard", () => {
    rendered = renderPalette();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "K",
          metaKey: true,
          bubbles: true,
          cancelable: true,
        })
      );
    });

    expect(paletteContent()).not.toBeNull();
  });

  it("opens when the header control asks for it", () => {
    rendered = renderPalette();

    act(() => {
      window.dispatchEvent(new Event("enoeda:open-student-search"));
    });

    expect(paletteContent()).not.toBeNull();
  });
});

describe("StudentSearchPalette searching", () => {
  it("asks for at least two letters before searching", () => {
    rendered = renderPalette();
    pressKey("k", window);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    const input = searchInput()!;
    act(() => {
      typeInto(input, "a");
    });

    expect(mocks.listStudents).not.toHaveBeenCalled();
    expect(paletteContent()?.textContent).toContain(
      STUDENT_SEARCH_MESSAGES.MIN_QUERY_HINT
    );
  });

  it("lists the matches with their status", async () => {
    rendered = renderPalette();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    act(() => {
      typeInto(searchInput()!, "pe");
    });
    await flushSearch();

    const text = paletteContent()?.textContent ?? "";
    expect(text).toContain("Ana Pérez");
    expect(text).toContain(STUDENT_DIRECTORY_MESSAGES.ACTIVE_STATUS);
    expect(mocks.listStudents).toHaveBeenCalledWith(
      expect.objectContaining({ branch_id: BRANCH_ID, query: "pe" })
    );
  });

  it("shows each student once even if both queries return it", async () => {
    rendered = renderPalette();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    act(() => {
      typeInto(searchInput()!, "pe");
    });
    await flushSearch();

    const options = paletteContent()?.querySelectorAll('[role="option"]') ?? [];
    expect(options).toHaveLength(STUDENT_CATALOG.length);
    expect(
      [...options].filter((option) =>
        option.textContent?.includes("Ana Pérez")
      )
    ).toHaveLength(1);
  });

  it("says so in Spanish when nothing matches", async () => {
    searchReturns([]);
    rendered = renderPalette();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    act(() => {
      typeInto(searchInput()!, "zzz");
    });
    await flushSearch();

    expect(paletteContent()?.textContent).toContain(
      STUDENT_SEARCH_MESSAGES.NO_RESULTS("zzz")
    );
  });

  it("keeps the palette open when the search fails", async () => {
    mocks.listStudents.mockResolvedValue({
      success: false,
      error: "boom",
    });
    rendered = renderPalette();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });

    act(() => {
      typeInto(searchInput()!, "pe");
    });
    await flushSearch();

    expect(paletteContent()).not.toBeNull();
    expect(paletteContent()?.textContent).toContain(
      STUDENT_SEARCH_MESSAGES.SEARCH_ERROR
    );
    expect(mocks.push).not.toHaveBeenCalled();
  });
});

describe("StudentSearchPalette destinations", () => {
  async function openEmpty(props: Parameters<typeof renderPalette>[0] = {}) {
    rendered = renderPalette(props);
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });
  }

  it("lists the destinations before anything is typed", async () => {
    await openEmpty({ canManageProfile: true });

    const options = paletteContent()?.querySelectorAll('[role="option"]') ?? [];
    const labels = [...options].map((option) => option.textContent?.trim());

    expect(labels.some((label) => label?.includes("Calendario"))).toBe(true);
    expect(labels.some((label) => label?.includes("Estudiantes"))).toBe(true);
    expect(mocks.listStudents).not.toHaveBeenCalled();
  });

  it("narrows the destinations as the query matches a section", async () => {
    await openEmpty({ isAdmin: true, canManageProfile: true });

    act(() => {
      typeInto(searchInput()!, "perso");
    });

    const options = paletteContent()?.querySelectorAll('[role="option"]') ?? [];
    expect(options).toHaveLength(1);
    expect(options[0].textContent).toContain("Personal");
  });

  it("opens the highlighted section on Enter, keeping the branch", async () => {
    await openEmpty({ isAdmin: true, canManageProfile: true });

    act(() => {
      typeInto(searchInput()!, "perso");
    });
    pressKey("Enter", searchInput()!);

    expect(mocks.push).toHaveBeenCalledWith(
      `/dashboard/staff?branch=${BRANCH_ID}`
    );
    expect(paletteContent()).toBeNull();
  });

  it("hides admin-only destinations from a teacher-only caller", async () => {
    await openEmpty({ isAdmin: false, canManageProfile: true, isTeacherOnly: true });

    const options = paletteContent()?.querySelectorAll('[role="option"]') ?? [];
    const text = [...options].map((option) => option.textContent ?? "").join(" ");

    expect(text).not.toContain("Personal");
    expect(text).not.toContain("Pagos");
    expect(text).toContain("Conducta");
  });

  it("lists students after the matching destinations when there is a query", async () => {
    await openEmpty({ canManageProfile: true });

    act(() => {
      typeInto(searchInput()!, "pe");
    });
    await flushSearch();

    const options = [...(paletteContent()?.querySelectorAll('[role="option"]') ?? [])];
    // Destinations that match "pe" (Mi perfil) come first, then the students.
    expect(options.length).toBeGreaterThan(STUDENT_CATALOG.length);
    expect(options[0].textContent).toContain("Mi perfil");
    expect(
      options.slice(-STUDENT_CATALOG.length).map((option) => option.textContent)
    ).toEqual([
      expect.stringContaining("Ana Pérez"),
      expect.stringContaining("Bruno Díaz"),
    ]);
  });
});

describe("StudentSearchPalette navigation", () => {
  async function openWithResults() {
    rendered = renderPalette();
    act(() => {
      window.dispatchEvent(
        new KeyboardEvent("keydown", { key: "k", ctrlKey: true, bubbles: true })
      );
    });
    act(() => {
      typeInto(searchInput()!, "pe");
    });
    await flushSearch();
  }

  it("opens the first student on Enter, keeping the active branch", async () => {
    await openWithResults();

    pressKey("Enter", searchInput()!);

    expect(mocks.push).toHaveBeenCalledWith(
      `/dashboard/students/${STUDENT_A}?branch=${BRANCH_ID}`
    );
  });

  it("moves the highlight with the arrow keys before opening", async () => {
    await openWithResults();

    pressKey("ArrowDown", searchInput()!);
    pressKey("Enter", searchInput()!);

    expect(mocks.push).toHaveBeenCalledWith(
      `/dashboard/students/${STUDENT_B}?branch=${BRANCH_ID}`
    );
  });

  it("closes on Escape without navigating", async () => {
    await openWithResults();

    pressKey("Escape", searchInput()!);

    expect(paletteContent()).toBeNull();
    expect(mocks.push).not.toHaveBeenCalled();
  });
});
