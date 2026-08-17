import { describe, expect, it } from "vitest";

import { ownProfileSchema } from "./schema";

const validProfile = {
  first_name: "Ana",
  surname: "Pérez",
  phone: "0991234567",
  date_of_birth: "1995-03-15",
};

describe("ownProfileSchema", () => {
  it("accepts the four editable canonical profile fields", () => {
    expect(ownProfileSchema.safeParse(validProfile).success).toBe(true);
  });

  it("rejects invalid calendar dates", () => {
    const result = ownProfileSchema.safeParse({
      ...validProfile,
      date_of_birth: "2025-02-29",
    });

    expect(result.success).toBe(false);
  });

  it("rejects caller-controlled identity and branch fields", () => {
    const result = ownProfileSchema.safeParse({
      ...validProfile,
      user_id: "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d",
      branch_id: "f1e2d3c4-b5a6-4f7e-8d9c-0a1b2c3d4e5f",
    });

    expect(result.success).toBe(false);
  });
});
