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

export const DASHBOARD_SHELL_MESSAGES = {
  OVERVIEW: "Resumen",
  BRANCHES: "Sucursales",
  STUDENTS: "Estudiantes",
  MANAGEMENT: "Administración",
} as const

export const SIDEBAR_ACCESSIBILITY_MESSAGES = {
  TOGGLE: "Alternar barra lateral",
  MOBILE_TITLE: "Barra lateral",
  MOBILE_DESCRIPTION: "Muestra la barra lateral en dispositivos móviles.",
} as const

export const DIALOG_ACCESSIBILITY_MESSAGES = {
  CLOSE: "Cerrar",
} as const

export const DASHBOARD_OVERVIEW_MESSAGES = {
  WELCOME: "Le damos la bienvenida a Enoeda Academy",
  WORKSPACE_READY: "Su espacio de gestión académica está listo.",
  DATA_UNAVAILABLE_ALERT:
    "Los datos del resumen no están disponibles temporalmente. Aún puede abrir cada área de gestión directamente.",
  UNAVAILABLE: "No disponible",
  BRANCHES: "Sucursales",
  ACTIVE_BRANCHES_DESCRIPTION: "Sucursales activas de la academia.",
  ACTIVE_STUDENTS: "Estudiantes activos",
  ACTIVE_STUDENTS_DESCRIPTION: "Registros de estudiantes activos.",
  INACTIVE_STUDENTS: "Estudiantes inactivos",
  INACTIVE_STUDENTS_DESCRIPTION: "Registros de estudiantes marcados como inactivos.",
  ACTIVE_STUDENTS_BY_BRANCH: "Estudiantes activos por sucursal",
  ACTIVE_STUDENTS_BY_BRANCH_DESCRIPTION:
    "Registros de estudiantes activos en las sucursales activas de la academia.",
  BRANCH_DISTRIBUTION_UNAVAILABLE:
    "La distribución por sucursal no está disponible.",
  NO_ACTIVE_BRANCHES: "No hay sucursales activas disponibles.",
  ACTIVE_STUDENTS_BY_BRANCH_LIST_LABEL: "Estudiantes activos por sucursal",
  BRANCH_COUNT_ARIA_LABEL: (count: string) => `${count} sucursales activas`,
  ACTIVE_STUDENT_COUNT_ARIA_LABEL: (count: string) => `${count} estudiantes activos`,
  INACTIVE_STUDENT_COUNT_ARIA_LABEL: (count: string) =>
    `${count} estudiantes inactivos`,
  ACTIVE_STUDENTS_COUNT: (count: string) => `${count} activos`,
} as const

export const STUDENT_DIRECTORY_MESSAGES = {
  INITIAL_LOAD_FAILURE: "No se pudieron cargar los estudiantes. Inténtelo nuevamente.",
  LOAD_MORE_FAILURE: "No se pudieron cargar más estudiantes. Inténtelo nuevamente.",
  HEADING: "Estudiantes",
  ACTIVE_ACCOUNT_DESCRIPTION: "Registros de estudiantes activos disponibles para su cuenta.",
  INACTIVE_ACCOUNT_DESCRIPTION: "Registros de estudiantes inactivos disponibles para su cuenta.",
  ACTIVE_TAB: "Activos",
  HISTORY_TAB: "Historial",
  PAGINATION_LOADING_STATUS: "Cargando más estudiantes.",
  ACTIVE_EMPTY_STATE: "No se encontraron estudiantes activos.",
  INACTIVE_EMPTY_STATE: "No se encontraron estudiantes inactivos.",
  ACTIVE_TABLE_CAPTION: "Estudiantes activos",
  INACTIVE_TABLE_CAPTION: "Estudiantes inactivos",
  FIRST_NAME: "Nombre",
  SURNAME: "Apellido",
  BRANCH_ID: "ID de sucursal",
  STATUS: "Estado",
  ACTIONS: "Acciones",
  ACTIVE_STATUS: "Activo",
  INACTIVE_STATUS: "Inactivo",
  LOAD_MORE: "Cargar más",
} as const

export const BRANCH_DIRECTORY_MESSAGES = {
  INITIAL_LOAD_FAILURE: "No se pudieron cargar las sucursales. Inténtelo nuevamente.",
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

export const STUDENT_FORM_MESSAGES = {
  CREATE_TITLE: "Crear estudiante",
  EDIT_TITLE: "Editar estudiante",
  SAVE_CHANGES: "Guardar cambios",
  LOAD_FAILURE: "No se pudo cargar el estudiante.",
  SAVE_FAILURE: "No se pudo guardar el estudiante.",
  CREATE_DESCRIPTION: "Agregue un estudiante a una sucursal activa.",
  EDIT_DESCRIPTION: "Actualice los datos personales y de sucursal de este estudiante.",
  LOADING_DETAILS: "Cargando datos del estudiante…",
  DESTRUCTIVE_ALERT_TITLE: "No se pudo guardar el estudiante",
  ACTIVE_BRANCH_REQUIRED: "Seleccione una sucursal activa.",
  ACTIVE_BRANCH_PLACEHOLDER: "Seleccione una sucursal activa",
  EMAIL_REQUIRED: "El correo electrónico es obligatorio.",
  DATE_OF_BIRTH_REQUIRED: "La fecha de nacimiento es obligatoria.",
  DATE_OF_BIRTH_INVALID: "Ingrese una fecha de nacimiento válida.",
  FIRST_NAME_LABEL: "Nombre",
  SURNAME_LABEL: "Apellido",
  EMAIL_LABEL: "Correo electrónico",
  DATE_OF_BIRTH_LABEL: "Fecha de nacimiento",
  SAVING: "Guardando…",
} as const

export const STUDENT_LIFECYCLE_MESSAGES = {
  DEACTIVATE_TRIGGER: "Desactivar",
  DEACTIVATE_CONFIRMATION_TITLE: (studentName: string) => `¿Desactivar a ${studentName}?`,
  DEACTIVATE_CONFIRMATION_DESCRIPTION: `Este ${PRODUCT_TERMS.STUDENT.toLowerCase()} dejará de aparecer en la lista de ${PRODUCT_TERMS.STUDENT.toLowerCase()}s activos.`,
  DEACTIVATE_FAILURE: `No se pudo desactivar el ${PRODUCT_TERMS.STUDENT.toLowerCase()}.`,
  DEACTIVATE_ALERT_TITLE: `No se pudo desactivar el ${PRODUCT_TERMS.STUDENT.toLowerCase()}`,
  DEACTIVATING: `Desactivando ${PRODUCT_TERMS.STUDENT.toLowerCase()}…`,
  REACTIVATE_TRIGGER: "Reactivar",
  REACTIVATE_CONFIRMATION_TITLE: `¿Reactivar ${PRODUCT_TERMS.STUDENT.toLowerCase()}?`,
  REACTIVATE_CONFIRMATION_DESCRIPTION: `Este ${PRODUCT_TERMS.STUDENT.toLowerCase()} volverá a la lista de activos.`,
  REACTIVATION_BRANCH_REQUIRED: `Seleccione una ${PRODUCT_TERMS.BRANCH.toLowerCase()} activa para reactivar este ${PRODUCT_TERMS.STUDENT.toLowerCase()}.`,
  REACTIVATE_FAILURE: `No se pudo reactivar el ${PRODUCT_TERMS.STUDENT.toLowerCase()}.`,
  ACTIVE_BRANCH_LABEL: `${PRODUCT_TERMS.BRANCH} activa`,
  ACTIVE_BRANCH_PLACEHOLDER: `Seleccione una ${PRODUCT_TERMS.BRANCH.toLowerCase()} activa`,
  REACTIVATING: `Reactivando ${PRODUCT_TERMS.STUDENT.toLowerCase()}…`,
  REACTIVATE_ACTION: "Reactivar",
  CANCEL: COMMON_MESSAGES.CANCEL,
} as const

export const STUDENT_MESSAGES = {
  INVALID_ID: "El identificador del estudiante no es válido.",
  INVALID_BRANCH_ID: "El identificador de la sucursal no es válido.",
  FIRST_NAME_REQUIRED: "El nombre es obligatorio.",
  FIRST_NAME_MAX_LENGTH: "El nombre debe tener como máximo 100 caracteres.",
  SURNAME_REQUIRED: "El apellido es obligatorio.",
  SURNAME_MAX_LENGTH: "El apellido debe tener como máximo 100 caracteres.",
  NATIONAL_ID_REQUIRED: "La cédula es obligatoria.",
  NATIONAL_ID_MAX_LENGTH: "La cédula debe tener como máximo 30 caracteres.",
  INVALID_EMAIL: "El correo electrónico no es válido.",
  DATE_OF_BIRTH_FORMAT: "La fecha de nacimiento debe tener el formato YYYY-MM-DD.",
  INVALID_DATE_OF_BIRTH: "La fecha de nacimiento no es una fecha válida.",
  AT_LEAST_ONE_FIELD_REQUIRED: "Debe proporcionar al menos un campo.",
  NOT_FOUND: "Estudiante no encontrado.",
  ACTIVE_STUDENT_BRANCH_REQUIRED: "Se requiere una sucursal activa para un estudiante activo.",
  REACTIVATION_BRANCH_REQUIRED: "Se requiere una sucursal activa para reactivar este estudiante.",
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
