// @vitest-environment jsdom

import type { ReactNode } from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StudentInvitationListItem } from "@/lib/domain/student-enrollment";
import { STUDENT_ENROLLMENT_MESSAGES } from "@/lib/localization/es-ec";

const mocks = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  resendStudentInvitation: vi.fn(),
  revokeStudentInvitation: vi.fn(),
  toastSuccess: vi.fn(),
}));

interface TestCellContext {
  row: {
    original: StudentInvitationListItem;
  };
}

interface TestColumn {
  cell?: (context: TestCellContext) => ReactNode;
  id?: string;
}

interface DataTableMockProps {
  caption: string;
  columns: TestColumn[];
  data: StudentInvitationListItem[];
}

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mocks.push, refresh: mocks.refresh }),
}));
vi.mock("sonner", () => ({
  toast: { success: mocks.toastSuccess },
}));
vi.mock("@/lib/domain/student-enrollment", () => ({
  createStudentInvitation: vi.fn(),
  resendStudentInvitation: mocks.resendStudentInvitation,
  revokeStudentInvitation: mocks.revokeStudentInvitation,
  STUDENT_INVITATION_STATES: {
    ACCEPTED: "accepted",
    EXPIRED: "expired",
    NEEDS_REVIEW: "needs_review",
    PENDING: "pending",
    REVOKED: "revoked",
  },
}));
vi.mock("@/components/ui/data-table", () => ({
  DataTable: ({ caption, columns, data }: DataTableMockProps) => (
    <div data-caption={caption}>
      {data.map((invitation) => (
        <div key={invitation.id}>
          {columns.map((column) =>
            column.cell ? (
              <span key={column.id ?? "cell"}>
                {column.cell({ row: { original: invitation } })}
              </span>
            ) : null
          )}
        </div>
      ))}
    </div>
  ),
}));

import { InvitationManagement } from "./invitation-management";

const PENDING_INVITATION: StudentInvitationListItem = {
  branchId: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  createdAt: "2026-08-29T10:00:00.000Z",
  email: "student@example.com",
  expiresAt: "2026-09-05T10:00:00.000Z",
  id: "b1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
  passwordConfigured: false,
  state: "pending",
};

interface RenderedManagement {
  container: HTMLDivElement;
  unmount(): void;
}

function renderManagement(
  invitations: StudentInvitationListItem[]
): RenderedManagement {
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);

  act(() => {
    root.render(
      <InvitationManagement
        branchId={PENDING_INVITATION.branchId}
        branchName="Centro"
        invitations={invitations}
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

function findButton(
  container: HTMLDivElement,
  label: string
): HTMLButtonElement | undefined {
  return [...container.querySelectorAll("button")].find(
    (button) => button.textContent === label
  );
}

describe("InvitationManagement", () => {
  let rendered: RenderedManagement | undefined;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.clearAllMocks();
    mocks.resendStudentInvitation.mockResolvedValue({
      data: { id: "new-invitation" },
      success: true,
    });
    mocks.revokeStudentInvitation.mockResolvedValue({
      data: { revoked: true },
      success: true,
    });
  });

  afterEach(() => {
    rendered?.unmount();
    rendered = undefined;
    vi.restoreAllMocks();
  });

  it("renders the shared DataTable and exposes resend and revoke actions for a pending invitation", async () => {
    rendered = renderManagement([PENDING_INVITATION]);
    const { container } = rendered;

    expect(
      container.querySelector('[data-caption="Invitaciones de estudiantes"]')
    ).not.toBeNull();
    expect(container.textContent).toContain(PENDING_INVITATION.email);

    const resendButton = findButton(container, "Reenviar");
    expect(resendButton).toBeDefined();

    await act(async () => {
      resendButton?.click();
    });

    expect(mocks.resendStudentInvitation).toHaveBeenCalledWith({
      id: PENDING_INVITATION.id,
    });
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it("refreshes the table when a resend revokes the old invitation but cannot replace it", async () => {
    mocks.resendStudentInvitation.mockResolvedValue({
      error: STUDENT_ENROLLMENT_MESSAGES.INVITATION_REQUIRES_REVIEW,
      success: false,
    });
    const management = renderManagement([PENDING_INVITATION]);
    rendered = management;

    await act(async () => {
      findButton(management.container, "Reenviar")?.click();
    });

    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(management.container.textContent).toContain(
      STUDENT_ENROLLMENT_MESSAGES.INVITATION_REQUIRES_REVIEW
    );
    expect(mocks.toastSuccess).not.toHaveBeenCalled();
  });

  it("does not show destructive invitation actions after acceptance", () => {
    rendered = renderManagement([
      { ...PENDING_INVITATION, state: "accepted" },
    ]);

    expect(rendered.container.textContent).not.toContain("Reenviar");
    expect(rendered.container.textContent).not.toContain("Revocar");
  });
});
