import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listPublicActiveBranches: vi.fn(),
}));

vi.mock("@/components/student-registration/public-student-registration-form", () => ({
  PublicStudentRegistrationForm: ({ branches }: { branches: Array<{ id: string; name: string }> }) => (
    <div data-branch-count={branches.length} />
  ),
}));
vi.mock("@/lib/domain/student-registration", () => ({
  listPublicActiveBranches: mocks.listPublicActiveBranches,
}));

import PublicStudentRegistrationPage from "./page";

describe("PublicStudentRegistrationPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes only the server-loaded active branches to the public form", async () => {
    mocks.listPublicActiveBranches.mockResolvedValue([
      { id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d", name: "Centro" },
    ]);

    const markup = renderToStaticMarkup(await PublicStudentRegistrationPage());

    expect(mocks.listPublicActiveBranches).toHaveBeenCalledTimes(1);
    expect(markup).toContain('data-branch-count="1"');
  });
});
