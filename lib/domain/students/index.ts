export {
  studentCreateSchema,
  studentIdSchema,
  studentUpdateSchema,
  type StudentCreateInput,
  type StudentUpdateInput,
} from "./schema";

export {
  createStudent,
  deactivateStudent,
  getStudentById,
  type ActionResult,
  type StudentProfile,
} from "./actions";
