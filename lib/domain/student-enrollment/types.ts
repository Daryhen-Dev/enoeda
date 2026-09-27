export interface StudentEnrollmentActionResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}
