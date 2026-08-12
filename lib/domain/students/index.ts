export {
  studentCreateSchema,
  studentIdSchema,
  studentListSchema,
  studentUpdateSchema,
  type StudentCreateInput,
  type StudentListInput,
  type StudentUpdateInput,
} from "./schema";

export {
  createStudent,
  deactivateStudent,
  getStudentById,
  listStudents,
  updateStudent,
  type ActionResult,
  type StudentListItem,
  type StudentListPage,
  type StudentProfile,
} from "./actions";
