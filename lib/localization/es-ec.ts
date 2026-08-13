export const USER_LOCALE = "es-EC" as const

export const PRODUCT_TERMS = {
  BRANCH: "Sucursal",
  STUDENT: "Estudiante",
  NATIONAL_ID: "Cédula",
} as const

export const COMMON_MESSAGES = {
  CANCEL: "Cancelar",
  CREATE: "Crear",
  EDIT: "Editar",
  SAVE: "Guardar",
  LOADING: "Cargando…",
  UNEXPECTED_ERROR: "Ocurrió un error inesperado.",
  AUTHENTICATION_REQUIRED: "Debe iniciar sesión para continuar.",
  INSUFFICIENT_PERMISSIONS: "No tiene permisos para realizar esta acción.",
} as const

export const BRANCH_MESSAGES = {
  INVALID_ID: "El identificador de la sucursal no es válido.",
  NAME_REQUIRED: "El nombre de la sucursal es obligatorio.",
  NAME_MAX_LENGTH: "El nombre de la sucursal debe tener como máximo 100 caracteres.",
  ADDRESS_MAX_LENGTH: "La dirección debe tener como máximo 255 caracteres.",
  PHONE_MAX_LENGTH: "El teléfono debe tener como máximo 30 caracteres.",
  INVALID_TIME_ZONE: "La zona horaria debe ser una de las siguientes:",
  AT_LEAST_ONE_FIELD_REQUIRED: "Debe proporcionar al menos un campo.",
  NAME_ALREADY_EXISTS: "Ya existe una sucursal con este nombre.",
  CANNOT_DEACTIVATE_WITH_ACTIVE_STUDENTS: "No se puede desactivar una sucursal con estudiantes activos.",
  NOT_FOUND: "Sucursal no encontrada.",
  REACTIVATION_NAME_CONFLICT: "No se puede reactivar esta sucursal porque otra sucursal activa ya usa este nombre. Cambie el nombre de una de las sucursales primero.",
} as const

const DATE_FORMAT_OPTIONS = {
  dateStyle: "medium",
} as const satisfies Intl.DateTimeFormatOptions

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(USER_LOCALE, DATE_FORMAT_OPTIONS).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(USER_LOCALE).format(value)
}
