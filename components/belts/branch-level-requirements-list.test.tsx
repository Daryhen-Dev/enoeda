// @vitest-environment jsdom

import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BRANCH_LEVEL_MESSAGES, COMMON_MESSAGES } from "@/lib/localization/es-ec";

const BRANCH_ID = "bbbbbbbb-1111-2222-8333-444444444444";
const LEVEL_A = "d3333333-3333-4333-8333-333333333331";
const LEVEL_B = "d3333333-3333-4333-8333-333333333332";

const mocks = vi.hoisted(() => ({
  setBranchLevelRequirement: vi.fn(),
  clearBranchLevelRequirement: vi.fn(),
  refresh: vi.fn(),
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/lib/domain/levels/actions", () => ({
  setBranchLevelRequirement: mocks.setBranchLevelRequirement,
  clearBranchLevelRequirement: mocks.clearBranchLevelRequirement,
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess, error: mocks.toastError },
}));

import { BranchLevelRequirementsList } from "./branch-level-requirements-list";

interface RenderedList {
  container: HTMLDivElement;
  unmount(): void;
}

const DISCIPLINES = [
  {
    discipline_id: "c2222222-2222-4222-8222-222222222222",
    discipline_name: "Karate",
    levels: [
      {
        id: LEVEL_A,
        name: "Blanco",
        color: "#ffffff",
        sort_order: 0,
        general_required: 10,
        branch_required: null,
        effective_required: 10,
      },
      {
        id: LEVEL_B,
        name: "Amarillo",
        color: null,
        sort_order: 1,
        general_required: 20,
        branch_required: 5,
        effective_required: 5,
      },
    ],
  },
];

function renderList(): RenderedList {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <BranchLevelRequirementsList
        branchId={BRANCH_ID}
        disciplines={DISCIPLINES}
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

function queryRow(levelName: string): HTMLTableRowElement {
  const rows = [
    ...document.querySelectorAll<HTMLTableRowElement>("tbody tr"),
  ];
  const row = rows.find((row) => row.textContent?.includes(levelName));
  expect(row).toBeDefined();
  return row!;
}

function queryBranchInput(row: HTMLTableRowElement): HTMLInputElement {
  const input = row.querySelector<HTMLInputElement>('input[type="number"]');
  expect(input).toBeDefined();
  return input!;
}

function queryButton(row: HTMLTableRowElement, label: string) {
  return [...row.querySelectorAll<HTMLButtonElement>("button")].find(
    (button) => button.textContent?.includes(label)
  );
}

async function setInputValue(input: HTMLInputElement, value: string) {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(
      HTMLInputElement.prototype,
      "value"
    )?.set;
    setter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

describe("BranchLevelRequirementsList", () => {
  let rendered: RenderedList | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & {
      IS_REACT_ACT_ENVIRONMENT: boolean;
    }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.setBranchLevelRequirement.mockResolvedValue({
      success: true,
      data: { id: "override-1" },
    });
    mocks.clearBranchLevelRequirement.mockResolvedValue({
      success: true,
      data: { branch_id: BRANCH_ID, level_id: LEVEL_B },
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("shows the general value, the branch input and the custom badge only for overrides", () => {
    rendered = renderList();

    const whiteRow = queryRow("Blanco");
    // The header column carries the "General" label; the row shows the value.
    expect(document.body.textContent).toContain(
      BRANCH_LEVEL_MESSAGES.GENERAL_LABEL
    );
    expect(whiteRow.textContent).toContain("10");
    expect(queryBranchInput(whiteRow).value).toBe("10");
    expect(whiteRow.textContent).not.toContain(
      BRANCH_LEVEL_MESSAGES.CUSTOM_BADGE
    );

    const yellowRow = queryRow("Amarillo");
    expect(queryBranchInput(yellowRow).value).toBe("5");
    expect(yellowRow.textContent).toContain(BRANCH_LEVEL_MESSAGES.CUSTOM_BADGE);
    // Explain that names and colors are owner-managed.
    expect(document.body.textContent).toContain(
      BRANCH_LEVEL_MESSAGES.OWNER_MANAGED_NOTE
    );
  });

  it("saves a changed branch value via setBranchLevelRequirement", async () => {
    rendered = renderList();

    const whiteRow = queryRow("Blanco");
    const input = queryBranchInput(whiteRow);
    await setInputValue(input, "7");

    const saveButton = queryButton(whiteRow, COMMON_MESSAGES.SAVE);
    expect(saveButton).toBeDefined();
    expect(saveButton!.disabled).toBe(false);

    await act(async () => {
      saveButton!.click();
    });
    await act(async () => {});

    expect(mocks.setBranchLevelRequirement).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      level_id: LEVEL_A,
      required_attended_sessions: 7,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      BRANCH_LEVEL_MESSAGES.SAVE_SUCCESS
    );
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("disables Guardar while the value is unchanged or invalid", async () => {
    rendered = renderList();

    const whiteRow = queryRow("Blanco");
    const saveButton = queryButton(whiteRow, COMMON_MESSAGES.SAVE);
    // Unchanged value → disabled.
    expect(saveButton!.disabled).toBe(true);

    const input = queryBranchInput(whiteRow);
    await setInputValue(input, "-3");
    // Invalid value → still disabled.
    expect(saveButton!.disabled).toBe(true);

    await setInputValue(input, "0");
    expect(saveButton!.disabled).toBe(false);
    expect(document.body.textContent).not.toContain(
      BRANCH_LEVEL_MESSAGES.REQUIRED_SESSIONS_INVALID
    );

    await setInputValue(input, "1500");
    expect(saveButton!.disabled).toBe(true);
  });

  it("resets to the general value via clearBranchLevelRequirement only when an override exists", async () => {
    rendered = renderList();

    const whiteRow = queryRow("Blanco");
    expect(
      queryButton(whiteRow, BRANCH_LEVEL_MESSAGES.USE_GENERAL_ACTION)
    ).toBeUndefined();

    const yellowRow = queryRow("Amarillo");
    const useGeneralButton = queryButton(
      yellowRow,
      BRANCH_LEVEL_MESSAGES.USE_GENERAL_ACTION
    );
    expect(useGeneralButton).toBeDefined();

    await act(async () => {
      useGeneralButton!.click();
    });
    await act(async () => {});

    expect(mocks.clearBranchLevelRequirement).toHaveBeenCalledWith({
      branch_id: BRANCH_ID,
      level_id: LEVEL_B,
    });
    expect(mocks.toastSuccess).toHaveBeenCalledWith(
      BRANCH_LEVEL_MESSAGES.RESET_SUCCESS
    );
    expect(mocks.refresh).toHaveBeenCalled();
    expect(mocks.setBranchLevelRequirement).not.toHaveBeenCalled();
  });
});
