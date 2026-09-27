import { describe, expect, it } from "vitest";

import { isPublicPath, isStudentPath } from "./authorize";
import { getStudentAuthHome } from "./redirect";

describe("student route boundaries", () => {
  it("keeps public registration routes public while student profiles remain protected", () => {
    expect(isPublicPath("/registro")).toBe(true);
    expect(isPublicPath("/registro/anything")).toBe(true);
    expect(isPublicPath("/api/public/altcha/challenge")).toBe(true);
    expect(isPublicPath("/api/public/student-registration")).toBe(true);
    expect(isPublicPath("/student")).toBe(false);
  });

  it("recognizes only the dedicated student route prefix", () => {
    expect(isStudentPath("/student")).toBe(true);
    expect(isStudentPath("/student/profile")).toBe(true);
    expect(isStudentPath("/students")).toBe(false);
  });

  it("uses fixed student and public registration destinations", () => {
    expect(getStudentAuthHome(true)).toBe("/student");
    expect(getStudentAuthHome(false)).toBe("/registro");
  });
});
