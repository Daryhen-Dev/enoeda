import { describe, expect, it } from "vitest";

import { isPublicPath, isStudentPath } from "./authorize";
import {
  getSafeEnrollmentCallbackRedirect,
  getStudentAuthHome,
} from "./redirect";

describe("student route boundaries", () => {
  it("keeps enrollment callback continuation public while student profiles remain protected", () => {
    expect(isPublicPath("/enroll")).toBe(true);
    expect(isPublicPath("/enroll/anything")).toBe(true);
    expect(isPublicPath("/student")).toBe(false);
  });

  it("recognizes only the dedicated student route prefix", () => {
    expect(isStudentPath("/student")).toBe(true);
    expect(isStudentPath("/student/profile")).toBe(true);
    expect(isStudentPath("/students")).toBe(false);
  });

  it("uses fixed student and enrollment destinations rather than user-provided paths", () => {
    expect(getStudentAuthHome(true)).toBe("/student");
    expect(getStudentAuthHome(false)).toBe("/enroll");
    expect(getSafeEnrollmentCallbackRedirect("/enroll")).toBe("/enroll");
    expect(getSafeEnrollmentCallbackRedirect("https://evil.example")).toBe(
      "/enroll"
    );
  });
});
