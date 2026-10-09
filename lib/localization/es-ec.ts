export const USER_LOCALE = "es-EC" as const

export const APPLICATION_METADATA_MESSAGES = {
  TITLE: "Enoeda Dojo",
  DESCRIPTION: "Plataforma de gestión académica.",
} as const

export const PRODUCT_TERMS = {
  BRANCH: "Sucursal",
  STUDENT: "Estudiante",
  NATIONAL_ID: "Cédula",
  DISCIPLINE: "Disciplina",
  DISCIPLINES: "Disciplinas",
} as const

export const COMMON_MESSAGES = {
  LAST_UPDATED: "Última modificación",
  CANCEL: "Cancelar",
  CREATE: "Crear",
  EDIT: "Editar",
  SAVE: "Guardar",
  LOADING: "Cargando…",
  UNEXPECTED_ERROR: "Ocurrió un error inesperado.",
  AUTHENTICATION_REQUIRED: "Debe iniciar sesión para continuar.",
  INSUFFICIENT_PERMISSIONS: "No tiene permisos para realizar esta acción.",
} as const

export const ECUADOR_TIME_ZONE_LABELS = {
  CONTINENTAL: "Ecuador continental — America/Guayaquil (UTC−5)",
  GALAPAGOS: "Galápagos — Pacific/Galapagos (UTC−6)",
} as const

/**
 * App-wide success-toast copy (top-right, sonner). Every create/save/
 * assign/revoke action confirms success with one of these instead of a
 * silent refresh.
 */
export const TOAST_MESSAGES = {
  BRANCH_CREATED: "Sucursal creada correctamente.",
  BRANCH_UPDATED: "Sucursal actualizada correctamente.",
  BRANCH_DEACTIVATED: "Sucursal desactivada correctamente.",
  BRANCH_REACTIVATED: "Sucursal reactivada correctamente.",
  BRANCH_DELETED: "Sucursal eliminada correctamente.",
  ADMIN_ACCOUNT_CREATED: "Cuenta de administrador creada correctamente.",
  ADMIN_CARGO_ASSIGNED_EXISTING: "Cargo asignado a la cuenta existente.",
  ADMIN_REVOKED: "Cargo de administrador revocado correctamente.",
  TEACHER_ACCOUNT_CREATED: "Cuenta de profesor creada correctamente.",
  TEACHER_REVOKED: "Cargo de profesor revocado correctamente.",
  STUDENT_CREATED: "Estudiante creado correctamente.",
  STUDENT_UPDATED: "Estudiante actualizado correctamente.",
  STUDENT_DEACTIVATED: "Estudiante desactivado correctamente.",
  STUDENT_REACTIVATED: "Estudiante reactivado correctamente.",
  PASSWORD_CHANGED: "Contraseña actualizada correctamente.",
  PROFILE_CREATED: "Perfil creado correctamente.",
  PROFILE_UPDATED: "Perfil actualizado correctamente.",
  DISCIPLINE_CREATED: "Disciplina creada correctamente.",
  STUDENT_ENROLLED: "Estudiante inscripto correctamente.",
  ENROLLMENT_SUSPENDED: "Inscripción suspendida.",
  ENROLLMENT_REACTIVATED: "Inscripción reactivada.",
  LEVEL_CREATED: "Nivel creado correctamente.",
  LEVEL_UPDATED: "Nivel actualizado correctamente.",
  STUDENT_PROMOTED: "Estudiante promovido correctamente.",
  STUDENT_PROMOTION_CORRECTED: "Promoción corregida correctamente.",
  NOTE_CREATED: "Nota creada correctamente.",
  NOTE_COMPLETED: "Nota completada.",
  NOTE_REOPENED: "Nota reabierta.",
  MONTHLY_PAYMENT_REGISTERED: "Pago mensual registrado correctamente.",
  CLASS_PAYMENT_REGISTERED: "Pago por clase registrado correctamente.",
  CLASS_PRICE_UPDATED: "Precio por clase actualizado.",
  PAYMENT_SETTINGS_UPDATED: "Configuración de pagos actualizada correctamente.",
  PAYMENT_CORRECTED: "Pago corregido correctamente.",
  PAYMENT_DELETED: "Pago eliminado correctamente.",
  STUDENT_PHONE_UPDATED: "Teléfono actualizado correctamente.",
} as const

export const STUDENT_ENROLLMENT_MESSAGES = {
  DATE_OF_BIRTH_LABEL: "Fecha de nacimiento",
  EMAIL_LABEL: "Correo electrónico",
  FIRST_NAME_LABEL: "Nombre",
  INACTIVE_READ_ONLY: "Su perfil está inactivo y solo puede consultarlo.",
  NATIONAL_ID_LABEL: "Cédula",
  PASSWORD_LABEL: "Nueva contraseña",
  PHONE_LABEL: "Teléfono",
  PHONE_MAX_LENGTH: "El teléfono debe tener como máximo 30 caracteres.",
  PHONE_SAVE_FAILURE: "No se pudo actualizar el teléfono. Inténtelo nuevamente.",
  PROFILE_TITLE: "Mi perfil",
  PROFILE_UNAVAILABLE: "No hay un perfil de estudiante disponible para esta cuenta.",
  STUDENT_AREA_DESCRIPTION: "Consulte sus datos personales y mantenga actualizado su teléfono.",
  STUDENT_AREA_TITLE: "Área de estudiante",
  SURNAME_LABEL: "Apellido",
  UPDATE_PHONE_ACTION: "Actualizar teléfono",
  UPDATING: "Guardando…",
} as const

export const PUBLIC_STUDENT_REGISTRATION_MESSAGES = {
  BRANCH_LABEL: "Sucursal",
  CAPTCHA_FAILURE: "No se pudo verificar el desafío de seguridad. Inténtelo nuevamente.",
  CAPTCHA_LABEL: "Verificación de seguridad",
  CAPTCHA_LOADING: "Cargando verificación de seguridad…",
  CAPTCHA_REQUIRED: "Complete la verificación de seguridad para continuar.",
  DESCRIPTION: "Complete sus datos para crear su perfil de estudiante.",
  GENERIC_FAILURE:
    "No se pudo completar el registro. Comuníquese con la administración para continuar.",
  NO_ACTIVE_BRANCHES:
    "No hay sucursales activas disponibles. Comuníquese con la administración.",
  PENDING_DESCRIPTION:
    "Su registro está pendiente de activación por parte de la administración de su sucursal.",
  PENDING_TITLE: "Registro pendiente de activación",
  RATE_LIMITED:
    "Se alcanzó el límite de intentos. Espere unos minutos antes de volver a intentarlo.",
  REGISTER_ACTION: "Crear registro",
  REGISTERING: "Creando registro…",
  SIGN_IN_FAILURE:
    "El registro se creó, pero no se pudo iniciar sesión. Ingrese con sus credenciales para continuar.",
  SUCCESS: "Registro creado. Ya puede consultar su perfil mientras espera la activación.",
  TITLE: "Registro de estudiante",
} as const

export const AUTH_MESSAGES = {
  LOGIN_TITLE: "Iniciar sesión",
  LOGIN_DESCRIPTION: "Ingrese sus credenciales para continuar.",
  EMAIL_LABEL: "Correo electrónico",
  PASSWORD_LABEL: "Contraseña",
  LOGIN_ACTION: "Iniciar sesión",
  LOGIN_PENDING: "Iniciando sesión…",
  LOGIN_FAILURE: "No se pudo iniciar sesión. Inténtelo nuevamente.",
  LOGOUT_ACTION: "Cerrar sesión",
  LOGOUT_PENDING: "Cerrando sesión…",
  LOGOUT_FAILURE: "No se pudo cerrar sesión. Inténtelo nuevamente.",
  INVALID_EMAIL: "El correo electrónico no es válido.",
  FORGOT_PASSWORD_LINK: "¿Olvidó su contraseña?",
} as const

export const FORGOT_PASSWORD_MESSAGES = {
  PAGE_TITLE: "Recuperar contraseña",
  PAGE_DESCRIPTION:
    "Ingrese su correo electrónico y le enviaremos un enlace para restablecerla.",
  EMAIL_LABEL: "Correo electrónico",
  SEND_ACTION: "Enviar enlace",
  SEND_PENDING: "Enviando…",
  EMAIL_SENT:
    "Si el correo está registrado, recibirá un enlace para restablecer su contraseña. Revise también su carpeta de spam.",
  FAILURE: "No se pudo enviar el enlace. Inténtelo nuevamente.",
  BACK_TO_LOGIN: "Volver a iniciar sesión",
} as const

export const RESET_PASSWORD_MESSAGES = {
  PAGE_TITLE: "Nueva contraseña",
  PAGE_DESCRIPTION: "Defina su nueva contraseña para continuar.",
  ACTION: "Guardar contraseña",
  PENDING: "Guardando…",
  FAILURE: "No se pudo actualizar la contraseña. Inténtelo nuevamente.",
} as const

export const DASHBOARD_SHELL_MESSAGES = {
  OVERVIEW: "Resumen",
  BRANCHES: "Sucursales",
  STUDENTS: "Estudiantes",
  STAFF: "Personal",
  MANAGEMENT: "Administración",
  CALENDAR: "Calendario",
  CLASS_SCHEDULES: "Horarios de clases",
  BELTS: "Cinturones",
  PAYMENTS: "Pagos",
  PAYMENT_SETTINGS: "Configuración de pagos",
  PAYMENT_VALIDATION: "Validación mensual",
  PROFILE: "Mi perfil",
  PROFILE_NAME_UNAVAILABLE: "Perfil pendiente",
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
  NO_BRANCH_CONTEXT: "No tiene una sucursal activa asignada. Contacte al administrador.",
  WELCOME: "Le damos la bienvenida a Enoeda Dojo",
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
  OVERDUE_STUDENTS: "Pagos en espera",
  OVERDUE_STUDENTS_DESCRIPTION: "Inscripciones con pago pendiente.",
  OVERDUE_STUDENT_COUNT_ARIA_LABEL: (count: string) =>
    `${count} inscripciones con pago pendiente`,
} as const

export const STUDENT_DIRECTORY_MESSAGES = {
  PAGE_TITLE: "Estudiantes",
  NO_BRANCH_CONTEXT: "No tiene una sucursal activa asignada. Contacte al administrador.",
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
  NATIONAL_ID: "Cédula",
  SEARCH_LABEL: "Buscar estudiantes",
  SEARCH_PLACEHOLDER: "Buscar por nombre o apellido",
  DISCIPLINE_FILTER_LABEL: "Filtrar por disciplina",
  ALL_DISCIPLINES: "Todas las disciplinas",
  INVALID_FILTER: "Los filtros de estudiantes no son válidos.",
  QUERY_MAX_LENGTH: "La búsqueda debe tener como máximo 100 caracteres.",
  INVALID_DISCIPLINE_ID: "La disciplina seleccionada no es válida.",
  BRANCH: "Sucursal",
  DISCIPLINES: "Disciplinas",
  NO_ACTIVE_DISCIPLINES: "Sin disciplinas activas.",
  STATUS: "Estado",
  VIEW_DETAILS: "Ver detalle",
  ACTIONS: "Acciones",
  PAYMENT_ENROLLMENTS_LABEL: "Acciones de pago por inscripción",
  PAYMENT_ACTIONS_BY_DISCIPLINE: (disciplineName: string) =>
    `Acciones de pago para ${disciplineName}`,
  NO_PAYMENT_ENROLLMENTS: "Sin inscripciones activas para registrar pagos.",
  ADMINISTRATIVE_ACTIONS_LABEL: "Acciones administrativas",
  MONTHLY_DUE_DATE: "Vencimiento mensual",
  NO_PAYMENTS_REGISTERED: "Sin pagos registrados.",
  PER_CLASS_DUE_DATE: "Por clase",
  DUE_IN_DAYS: (days: number) =>
    days === 1 ? "1 día restante" : `${days} días restantes`,
  DUE_TODAY: "Vence hoy",
  OVERDUE_BY_DAYS: (days: number) =>
    days === 1 ? "Vencido hace 1 día" : `Vencido hace ${days} días`,
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
  CANNOT_DELETE_WITH_STUDENTS: "No se puede eliminar una sucursal con estudiantes registrados.",
  CANNOT_DELETE_WITH_STAFF: "No se puede eliminar una sucursal con administradores o profesores asignados.",
  NOT_FOUND: "Sucursal no encontrada.",
  INACTIVE_OR_NOT_FOUND: "La sucursal está inactiva o no existe.",
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
  PHONE_LABEL: "Teléfono",
  EDIT_BRANCH_UNAVAILABLE: "Sucursal del estudiante no disponible.",
  DATE_OF_BIRTH_REQUIRED: "La fecha de nacimiento es obligatoria.",
  DATE_OF_BIRTH_INVALID: "Ingrese una fecha de nacimiento válida.",
  FIRST_NAME_LABEL: "Nombre",
  SURNAME_LABEL: "Apellido",
  EMAIL_LABEL: "Correo electrónico",
  DATE_OF_BIRTH_LABEL: "Fecha de nacimiento",
  SAVING: "Guardando…",
} as const

export const STUDENT_LIFECYCLE_MESSAGES = {
  ACTIVATE_TRIGGER: "Activar registro",
  ACTIVATE_CONFIRMATION_TITLE: (studentName: string) =>
    `¿Activar el registro de ${studentName}?`,
  ACTIVATE_CONFIRMATION_DESCRIPTION: `Este ${PRODUCT_TERMS.STUDENT.toLowerCase()} dejará de estar pendiente de activación.`,
  ACTIVATE_FAILURE: `No se pudo activar el registro del ${PRODUCT_TERMS.STUDENT.toLowerCase()}.`,
  ACTIVATE_ALERT_TITLE: `No se pudo activar el registro del ${PRODUCT_TERMS.STUDENT.toLowerCase()}`,
  ACTIVATING: `Activando registro…`,
  ACTIVATION_SUCCESS: "Registro de estudiante activado correctamente.",
  ACTIVATION_STATUS_LABEL: "Activación",
  PENDING_ACTIVATION_STATUS: "Pendiente de activación",
  ACTIVE_ACTIVATION_STATUS: "Activado",
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
  PHONE_MAX_LENGTH: "El teléfono debe tener como máximo 30 caracteres.",
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

const DATE_TIME_FORMAT_OPTIONS = {
  dateStyle: "medium",
  timeStyle: "short",
} as const satisfies Intl.DateTimeFormatOptions

export function formatDate(value: Date): string {
  return new Intl.DateTimeFormat(USER_LOCALE, DATE_FORMAT_OPTIONS).format(value)
}

export function formatDateTime(value: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat(USER_LOCALE, {
    ...DATE_TIME_FORMAT_OPTIONS,
    ...(timeZone ? { timeZone } : {}),
  }).format(value)
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat(USER_LOCALE).format(value)
}

export const OWNER_MESSAGES = {
  SHELL_TITLE: "Panel de propietario",
  CONTROL_PLANE: "Panel de control",
  OVERVIEW: "Resumen",
  BRANCHES: "Sucursales",
  MANAGEMENT: "Administración",
  BRANCHES_TITLE: "Sucursales",
  BRANCHES_DESCRIPTION: "Administre las sucursales de la academia.",
  BRANCHES_EMPTY: "Sin sucursales",
  BRANCHES_EMPTY_DESCRIPTION: "Cree una sucursal para comenzar.",
  CREATE_BRANCH: "Crear sucursal",
  CREATE_BRANCH_TITLE: "Nueva sucursal",
  CREATE_BRANCH_DESCRIPTION: "Ingrese los datos de la nueva sucursal.",
  EDIT_BRANCH: "Editar sucursal",
  BRANCH_NAME: "Nombre",
  BRANCH_ADDRESS: "Dirección",
  BRANCH_PHONE: "Teléfono",
  BRANCH_STATUS: "Estado",
  STATUS_ACTIVE: "Activa",
  STATUS_INACTIVE: "Inactiva",
  ACTIONS: "Acciones",
  MANAGE: "Administrar",
  DEACTIVATE_ACTION: "Desactivar",
  DEACTIVATE_CONFIRMATION_TITLE: "¿Desactivar esta sucursal?",
  DEACTIVATE_CONFIRMATION_DESCRIPTION: "Los administradores y profesores asignados perderán acceso operativo a esta sucursal.",
  DEACTIVATE_ERROR: "No se pudo desactivar la sucursal.",
  REACTIVATE_ACTION: "Reactivar",
  REACTIVATE_ERROR: "No se pudo reactivar la sucursal.",
  DELETE_ACTION: "Eliminar",
  DELETE_CONFIRMATION_TITLE: "¿Eliminar esta sucursal?",
  DELETE_CONFIRMATION_DESCRIPTION: "Esta acción no se puede revertir. Solo puede eliminar sucursales sin estudiantes ni personal asignado.",
  DELETE_ERROR: "No se pudo eliminar la sucursal.",
  ADMINS_TITLE: "Administradores",
  ADMINS_DESCRIPTION: "Asigne o revoque el rol de administrador en esta sucursal.",
  ADMINS_EMPTY: "Sin administradores",
  ADMINS_EMPTY_DESCRIPTION: "Asigne un administrador a esta sucursal.",
  ASSIGN_ADMIN: "Asignar administrador",
  ASSIGN_ADMIN_TITLE: "Asignar administrador",
  ASSIGN_ADMIN_DESCRIPTION: "Cree una cuenta de administrador y complete sus datos personales.",
  ASSIGN_EXISTING_ADMIN: "Asignar existente",
  ASSIGN_EXISTING_ADMIN_TITLE: "Asignar administrador existente",
  ASSIGN_EXISTING_ADMIN_DESCRIPTION: "Asigne el cargo de administradora de esta sucursal a una cuenta ya existente mediante su correo electrónico.",
  ASSIGN_EXISTING_ADMIN_ACTION: "Asignar cargo",
  REVOKE_ACTION: "Revocar cargo",
  REVOKE_ADMIN_TITLE: "¿Revocar el cargo de administrador?",
  REVOKE_ADMIN_DESCRIPTION: "La persona perderá el cargo de administradora de esta sucursal. Su cuenta y sus datos no se eliminan.",
  REVOKE_ERROR: "No se pudo revocar el cargo.",
  NAME: "Nombre",
  PROFILE_UNAVAILABLE: "Perfil pendiente",
  ASSIGNED_AT: "Asignado",
  LOAD_FAILURE: "No se pudieron cargar los datos.",
  OVERVIEW_DESCRIPTION: "Resumen general de sucursales y administradores.",
  BRANCH_DETAIL_DESCRIPTION: "Administre los detalles de esta sucursal.",
  DISCIPLINES: "Disciplinas",
  DISCIPLINES_DESCRIPTION: "Gestioná el catálogo de disciplinas.",
  CREATE_DISCIPLINE: "Crear disciplina",
} as const

/** Shared messages for owner/admin account-creation flows. */
export const ROLE_CREATION_MESSAGES = {
  EMAIL_ALREADY_EXISTS: "Ya existe una cuenta con este correo electrónico.",
  ALREADY_ADMIN_IN_BRANCH: "Esta persona ya es administradora de esta sucursal.",
  NO_ACCOUNT_FOR_EMAIL:
    "No existe una cuenta con ese correo electrónico. La persona debe tener una cuenta antes de poder asignarle el cargo.",
  ALREADY_TEACHER_IN_BRANCH: "Esta persona ya es profesora activa de esta sucursal.",
  EXISTING_ACCOUNT_ASSIGNED_TITLE: "Cargo asignado a una cuenta existente",
  EXISTING_ACCOUNT_ASSIGNED_DESCRIPTION:
    "El correo electrónico ya tenía una cuenta en el sistema. Se le asignó el cargo de administradora de la sucursal. No se generó una contraseña nueva.",
  CREATE_ACCOUNT_ACTION: "Crear cuenta",
  CREATING_ACCOUNT: "Creando cuenta…",
  EMAIL_LABEL: "Correo electrónico",
  EMAIL_PLACEHOLDER: "usuario@ejemplo.com",
  FIRST_NAME_LABEL: "Nombre",
  SURNAME_LABEL: "Apellido",
  PHONE_LABEL: "Teléfono",
  DATE_OF_BIRTH_LABEL: "Fecha de nacimiento",
  CREDENTIALS_DIALOG_TITLE: "Cuenta creada",
  CREDENTIALS_DIALOG_DESCRIPTION:
    "Copie estas credenciales y entréguelas de forma segura a la persona. No se mostrarán de nuevo. Deberá cambiar la contraseña en su primer inicio de sesión.",
  CREDENTIALS_EMAIL_LABEL: "Correo electrónico",
  CREDENTIALS_PASSWORD_LABEL: "Contraseña temporal",
  COPY_ACTION: "Copiar",
  COPIED_ACTION: "Copiado",
  CLOSE_ACTION: "Cerrar",
} as const

export const TEACHER_PROFILE_MESSAGES = {
  INVALID_EMAIL: "El correo electrónico no es válido.",
  INVALID_BRANCH_ID: "El identificador de la sucursal no es válido.",
  FIRST_NAME_REQUIRED: "El nombre es obligatorio.",
  FIRST_NAME_MAX_LENGTH: "El nombre debe tener como máximo 100 caracteres.",
  SURNAME_REQUIRED: "El apellido es obligatorio.",
  SURNAME_MAX_LENGTH: "El apellido debe tener como máximo 100 caracteres.",
  PHONE_MAX_LENGTH: "El teléfono debe tener como máximo 30 caracteres.",
  DATE_OF_BIRTH_FORMAT: "La fecha de nacimiento debe tener el formato YYYY-MM-DD.",
  INVALID_DATE_OF_BIRTH: "La fecha de nacimiento no es una fecha válida.",
} as const

/** Forced password-change screen shown to accounts created by owner/admin. */
export const CHANGE_PASSWORD_MESSAGES = {
  PAGE_TITLE: "Cambiar contraseña",
  PAGE_DESCRIPTION:
    "Por seguridad, debe establecer una nueva contraseña antes de continuar.",
  NEW_PASSWORD_LABEL: "Nueva contraseña",
  CONFIRM_PASSWORD_LABEL: "Confirmar contraseña",
  MIN_LENGTH_ERROR: "La contraseña debe tener al menos 8 caracteres.",
  MISMATCH_ERROR: "Las contraseñas no coinciden.",
  SUBMIT_ACTION: "Guardar y continuar",
  SUBMITTING: "Guardando…",
  FAILURE: "No se pudo actualizar la contraseña. Inténtelo nuevamente.",
} as const

export const TEACHER_MANAGEMENT_MESSAGES = {
  PAGE_TITLE: "Profesores",
  PAGE_DESCRIPTION: "Administre los profesores asignados a su sucursal.",
  NO_BRANCH_CONTEXT: "No se encontró una sucursal asociada a su cuenta de administrador.",
  LOAD_FAILURE: "No se pudieron cargar los profesores.",
  EMPTY_STATE: "Sin profesores",
  NAME_LABEL: "Nombre",
  EMAIL_LABEL: "Correo electrónico",
  EMAIL_UNAVAILABLE: "Correo electrónico no disponible",
  PROFILE_UNAVAILABLE: "Perfil pendiente",
  ASSIGNED_AT_LABEL: "Asignado",
  ACTIONS_LABEL: "Acciones",
  ROLE_LABEL: "Rol",
  ASSIGN_ACTION: "Asignar profesor",
  ASSIGN_DIALOG_TITLE: "Asignar profesor",
  ASSIGN_DIALOG_DESCRIPTION: "Cree una cuenta nueva e ingrese los datos de la persona que será profesora en esta sucursal.",
  MODE_TOGGLE_LABEL: "Modo de asignación",
  MODE_EXISTING: "Cuenta existente",
  MODE_CREATE: "Crear cuenta",
  EXISTING_MODE_DESCRIPTION:
    "Asigne el cargo de profesor a una cuenta ya registrada. Los datos personales se usan solo si la cuenta aún no tiene un perfil; nunca se sobrescriben los datos existentes.",
  EXISTING_MODE_SUBMIT: "Asignar cargo",
  EXISTING_ACCOUNT_ASSIGNED_SUCCESS:
    "Cargo de profesor asignado a la cuenta existente correctamente.",
  ASSIGNING: "Asignando…",
  DEACTIVATE_ACTION: "Desactivar",
  DEACTIVATE_CONFIRMATION_TITLE: "¿Desactivar acceso de profesor?",
  DEACTIVATE_CONFIRMATION_DESCRIPTION:
    "Las clases futuras asignadas a este profesor se reasignarán al profesor predeterminado de la sucursal.",
  DEACTIVATE_ERROR: "No se pudo desactivar el acceso de profesor.",
  DEACTIVATE_FAILURE: "No se pudo desactivar el profesor.",
  DEACTIVATING: "Desactivando…",
  DEACTIVATE_SUCCESS_TOAST: (reassignedClassCount: number) =>
    reassignedClassCount === 1
      ? "Profesor desactivado. Se reasignó 1 clase futura."
      : `Profesor desactivado. Se reasignaron ${reassignedClassCount} clases futuras.`,
  DEACTIVATE_NO_DEFAULT_TEACHER:
    "No hay un profesor predeterminado configurado para esta sucursal.",
  DEACTIVATE_DEFAULT_TEACHER:
    "No se puede desactivar al profesor predeterminado. Cambie el profesor predeterminado primero.",
  DEACTIVATE_NO_ACTIVE_ADMIN:
    "No se puede desactivar porque no hay otro administrador activo para asumir el rol docente predeterminado.",
  DEACTIVATE_CONFLICT_DETAIL: (dayOfWeek: number, startTime: string) =>
    `Día ${dayOfWeek} a las ${startTime}`,
  DEACTIVATE_CONFLICT: (details: string) =>
    `Existe un conflicto de horario con el profesor predeterminado: ${details}`,
  REACTIVATE_ACTION: "Reactivar",
  REACTIVATING: "Reactivando…",
  REACTIVATE_FAILURE: "No se pudo reactivar el profesor.",
  REACTIVATE_SUCCESS_TOAST: "Profesor reactivado correctamente.",
  TEACHER_ROLE_LABEL: "Profesor",
  DEACTIVATED_TEACHER_ROLE_LABEL: "Profesor desactivado",
  SELF_ENABLE_ACTION: "También soy profesor",
  SELF_ENABLE_ENABLING: "Activando…",
  SELF_ENABLE_SUCCESS: "Ahora también es profesor en esta sucursal.",
  SELF_ADMIN_ROLE_LABEL: "Administrador",
} as const


export const DISCIPLINE_MESSAGES = {
  INVALID_ID: "Identificador de disciplina inválido.",
  NAME_REQUIRED: "El nombre es obligatorio.",
  NAME_MAX_LENGTH: "El nombre no puede superar 100 caracteres.",
  CODE_REQUIRED: "El código es obligatorio.",
  CODE_MAX_LENGTH: "El código no puede superar 50 caracteres.",
  CODE_FORMAT: "El código solo admite minúsculas, números y guiones.",
  NAME_ALREADY_EXISTS: "Ya existe una disciplina con ese nombre.",
  CODE_ALREADY_EXISTS: "Ya existe una disciplina con ese código.",
  NOT_FOUND: "Disciplina no encontrada.",
  LOAD_FAILURE: "No se pudieron cargar las disciplinas.",
} as const

export const DISCIPLINE_FORM_MESSAGES = {
  CREATE_TITLE: "Crear disciplina",
  CREATE_DESCRIPTION: "Agregá una nueva disciplina al catálogo.",
  NAME_LABEL: "Nombre",
  CODE_LABEL: "Código",
} as const

export const CALENDAR_MESSAGES = {
  PAGE_TITLE: "Calendario",
  DAY_VIEW: "Día",
  MONTH_VIEW: "Mensual",
  WEEK_VIEW: "Semanal",
  VIEW_SELECTOR_LABEL: "Seleccionar vista del calendario",
  TODAY: "Hoy",
  PREV: "Anterior",
  NEXT: "Siguiente",
  DAY_AGENDA: "Agenda del día",
  DAY_EMPTY_STATE: "No hay sesiones programadas para esta fecha.",
  MONTH_DATE_SELECTOR_LABEL: "Seleccionar una fecha del mes",
  DATE_SELECTOR_ARIA_LABEL: (date: string, sessionCount: number, isSelected: boolean) =>
    `${date}. ${sessionCount === 1 ? "1 sesión" : `${sessionCount} sesiones`}.${
      isSelected ? " Fecha seleccionada." : ""
    }`,
  SESSION_INFO_ARIA_LABEL: (discipline: string, startTime: string, date: string) =>
    `Abrir información de ${discipline}, ${date}, a las ${startTime}`,
  FILTER_DISCIPLINES: "Filtrar por disciplina",
  NO_TEACHER: "Sin profesor",
  TEACHER_DISPLAY_NAME: (name: string) => `Profesor: ${name}`,
  TEACHER_PROFILE_UNAVAILABLE: "Perfil de profesor no disponible",
  SUSPENDED_BADGE: "Suspendida",
  COMPACT_STATUS_SUSPENDED: "Suspendida",
  COMPACT_STATUS_COMPLETED: "Realizada",
  COMPACT_STATUS_SCHEDULED: "Programada",
  SUBSTITUTE: "Sustituto",
  ATTENDANCE_RECORDED: (presentCount: number) =>
    `Asistencia registrada · ${presentCount} presentes`,
  ATTENDANCE_PRESENT_COUNT: (presentCount: number) =>
    presentCount === 1
      ? `${presentCount} estudiante asistió`
      : `${presentCount} estudiantes asistieron`,
  NO_BRANCH_CONTEXT: "No se encontró una sucursal asociada a su cuenta.",
  LOAD_FAILURE: "No se pudo cargar el calendario.",
} as const

export const WEEKDAY_LABELS = [
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
  "Domingo",
] as const

export const CLASS_MESSAGES = {
  BRANCH_CONTEXT_REQUIRED:
    "Se requiere contexto de sucursal activa para esta operación.",
  BRANCH_MISMATCH:
    "La clase no pertenece a la sucursal activa. Seleccione la sucursal correcta.",
  NOT_FOUND:
    "La clase solicitada no existe o no tiene permisos para accederla.",
  CREATE_DESCRIPTION:
    "Cree un grupo mensual de clases: se generan todas las clases semanales del mes seleccionado en una sola operación.",
  DISCIPLINE_LABEL: "Disciplina",
  DISCIPLINE_PLACEHOLDER: "Seleccionar…",
  DAY_LABEL: "Día",
  DAYS_LABEL: "Días de la semana",
  START_TIME_LABEL: "Hora de inicio",
  TEACHER_LABEL: "Profesor",
  NO_TEACHER_OPTION: "Sin profesor asignado",
  SESSION_DATE_REQUIRED: "La fecha de la sesión es obligatoria.",
  CREATE_TITLE: "Crear grupo mensual de clases",
  MONTH_LABEL: "Mes",
  INVALID_PERIOD_MONTH: "El mes debe tener el formato AAAA-MM.",
  DUPLICATE_DAYS: "Los días de la semana no pueden repetirse.",
  MONTHLY_GROUP_CREATED: "Grupo mensual creado correctamente.",
  MONTHLY_GROUP_CREATED_DESCRIPTION:
    "El grupo mensual y sus clases semanales fueron creados. El grupo aún no tiene alumnos asignados.",
  ASSIGN_STUDENTS_ACTION: "Asignar alumnos",
  DEACTIVATED: "Clase desactivada.",
  SERIES_NAME_LABEL: "Nombre del grupo",
  SERIES_NAME_PLACEHOLDER: "Ej.: Karate infantil — Lunes y miércoles",
  SERIES_NAME_REQUIRED: "El nombre del grupo es obligatorio.",
  SERIES_NAME_MAX:
    "El nombre del grupo no puede superar 80 caracteres.",
  SERIES_TARGET_REQUIRED:
    "Indique la clase o el horario a quitar, no los dos.",
} as const

export const ROSTER_MESSAGES = {
  NOT_FOUND:
    "La clase indicada no existe o no tiene permisos para accederla.",
  UNAUTHORIZED:
    "Solo los administradores de la sucursal pueden modificar la lista de estudiantes.",
  TARGET_REQUIRED:
    "Indique el grupo mensual o la clase única a la que pertenece la lista.",
  STUDENT_IDS_REQUIRED: "Debe indicar al menos un estudiante.",
  STUDENT_IDS_TOO_LONG: "Puede agregar hasta 100 estudiantes por vez.",
  STUDENT_IDS_UNIQUE: "La lista de estudiantes contiene elementos duplicados.",
  SEARCH_MAX_LENGTH: "La búsqueda debe tener como máximo 100 caracteres.",
  SKIPPED_ALREADY_ASSIGNED: "El estudiante ya está en la lista de esta clase.",
  SKIPPED_NOT_ELIGIBLE:
    "El estudiante no tiene una inscripción mensual activa en esta disciplina.",
  SKIPPED_INACTIVE: "El estudiante está inactivo.",
  SKIPPED_BRANCH_MISMATCH: "El estudiante no pertenece a esta sucursal.",
} as const

export const ROSTER_EDITOR_MESSAGES = {
  SERIES_TITLE: "Alumnos del grupo",
  ONE_TIME_TITLE: "Alumnos de la clase única",
  DESCRIPTION:
    "Administre la lista de alumnos que pueden asistir a esta clase.",
  ROSTER_HEADING: "Alumnos en la lista",
  ROSTER_EMPTY_TITLE: "Aún no hay alumnos en la lista",
  ROSTER_EMPTY_DESCRIPTION:
    "Agregue alumnos desde la búsqueda de abajo: solo aparecen alumnos activos con inscripción mensual activa en esta disciplina.",
  CANDIDATES_HEADING: "Agregar alumnos",
  CANDIDATES_SEARCH_LABEL: "Buscar alumnos",
  CANDIDATES_SEARCH_PLACEHOLDER: "Nombre, apellido o cédula…",
  CANDIDATES_EMPTY:
    "No hay alumnos elegibles para agregar. Solo aparecen alumnos activos con inscripción mensual activa en esta disciplina; los alumnos por clase se agregan desde la hoja de asistencia.",
  ADD_SELECTED_ACTION: "Agregar seleccionados",
  ADD_SUCCESS: (addedCount: number) =>
    addedCount === 1
      ? "1 alumno agregado a la lista."
      : `${addedCount} alumnos agregados a la lista.`,
  SKIPPED_SUMMARY_TITLE: "Alumnos no agregados:",
  REMOVE_ACTION: "Quitar",
  REMOVE_ARIA_LABEL: (name: string) => `Quitar a ${name} de la lista`,
  REMOVE_CONFIRM_TITLE: "¿Quitar de la lista?",
  REMOVE_CONFIRM_DESCRIPTION: (name: string) =>
    `${name} dejará de estar asignado a esta clase. Su historial de asistencia se conserva.`,
  REMOVE_CONFIRM_ACTION: "Quitar de la lista",
  REMOVE_SUCCESS: "Alumno quitado de la lista correctamente.",
  CANDIDATES_HEADING_ARIA: "Resultados de búsqueda de alumnos candidatos",
  ROSTER_LIST_ARIA_LABEL: "Lista de alumnos asignados",
  ROSTER_ONE_TIME_ACTION: "Alumnos",
  ROSTER_SERIES_ACTION: "Alumnos del grupo",
} as const

export const CLONE_MESSAGES = {
  SOURCE_INACTIVE:
    "El grupo original está inactivo y no se puede clonar.",
  ALREADY_CLONED:
    "Este grupo ya fue clonado para el siguiente mes.",
  NO_ACTIVE_SLOTS:
    "El grupo original no tiene clases activas para copiar.",
  UNAUTHORIZED:
    "Solo los administradores de la sucursal pueden clonar grupos mensuales.",
  SUCCESS_SUMMARY: (
    month: string,
    copiedCount: number,
    skippedCount: number
  ) =>
    `Grupo clonado para ${month}: ${copiedCount} alumnos copiados, ${skippedCount} omitidos.`,
} as const

export const ONE_TIME_CLASS_MESSAGES = {
  CREATE_TITLE: "Crear clase única",
  CREATE_DESCRIPTION:
    "Agregue una clase para una sola fecha, fuera del horario semanal recurrente.",
  DATE_LABEL: "Fecha",
  CREATED: "Clase única creada correctamente.",
  CREATED_DESCRIPTION:
    "La clase única fue creada. Aún no tiene alumnos asignados.",
  ONE_TIME_BADGE: "Única",
} as const

export const SUSPENSION_MESSAGES = {
  CATEGORY_LABEL: "Categoría",
  CATEGORY_FERIADO: "Feriado",
  CATEGORY_EVENTO: "Evento",
  CATEGORY_EMERGENCIA: "Emergencia",
  CATEGORY_OTRO: "Otro",
  REASON_LABEL: "Motivo",
  REASON_REQUIRED_OTRO: "El motivo es obligatorio cuando la categoría es «Otro».",
  SUSPEND_TITLE: "Suspender sesión",
  REINSTATE_ACTION: "Reactivar sesión",
  SUSPENDED: "Sesión suspendida.",
  REINSTATED: "Sesión reactivada.",
} as const

export const REMOVE_RECURRING_CLASS_MESSAGES = {
  ACTION: "Quitar clase",
  DIALOG_TITLE: "¿Quitar el horario?",
  DIALOG_DESCRIPTION:
    "Las clases dejarán de aparecer en el calendario a partir de hoy según el alcance seleccionado. Las clases pasadas permanecerán visibles en el calendario con su historial de asistencia. Esta acción no se puede deshacer desde la aplicación.",
  SCOPE_GROUP_LABEL: "Alcance de la eliminación",
  SCOPE_SERIES_LABEL: "Todo el horario (toda la semana)",
  SCOPE_SERIES_HINT: (disciplineName: string, startTime: string) =>
    `Toda la semana para ${disciplineName} a las ${startTime}.`,
  SCOPE_SINGLE_LABEL: "Solo esta clase semanal",
  SCOPE_SINGLE_HINT:
    "Únicamente la clase de este día de la semana; las de los demás días en este horario siguen activas.",
  SCOPE_ALL_LABEL: "Todos los horarios de la sucursal",
  SCOPE_ALL_HINT:
    "Todos los horarios desde hoy; las clases únicas no se ven afectadas.",
  CONFIRM_ACTION: "Quitar clase",
  SUCCESS: "Clase recurrente quitada correctamente.",
  SUCCESS_SERIES: "Horario quitado correctamente.",
  SUCCESS_ALL: "Todos los horarios futuros fueron quitados correctamente.",
  ARIA_LABEL: (disciplineName: string, startTime: string) =>
    `Quitar el horario de ${disciplineName}, a las ${startTime}`,
} as const

export const SCHEDULE_SERIES_MESSAGES = {
  PAGE_TITLE: "Horarios de clases",
  PAGE_DESCRIPTION:
    "Administre los horarios de clases de la sucursal: grupos mensuales y clases únicas. Cree, renombre, clone o quite horarios.",
  NO_BRANCH_CONTEXT:
    "No tiene una sucursal activa asignada. Contacte al administrador.",
  LOAD_FAILURE:
    "No se pudieron cargar los horarios. Inténtelo nuevamente.",
  EMPTY_STATE:
    "No hay horarios registrados para esta sucursal.",
  NAME_LABEL: "Nombre",
  DISCIPLINE_LABEL: "Disciplina",
  MONTH_LABEL: "Mes",
  MONTH_FILTER_LABEL: "Filtrar por mes",
  MONTH_FILTER_ALL: "Todos",
  DAYS_LABEL: "Días",
  TIME_LABEL: "Hora",
  TEACHER_LABEL: "Profesor",
  CLASSES_LABEL: "Clases activas",
  STATE_LABEL: "Estado",
  ACTIONS_LABEL: "Acciones",
  ACTIVE_LABEL: "Activa",
  ALL_INACTIVE_LABEL: "Sin clases activas",
  NO_TEACHER: "Sin profesor asignado",
  ALL_INACTIVE_HINT:
    "Todas las clases de este horario fueron quitadas; el historial se conserva.",
  RENAME_ACTION: "Renombrar",
  RENAME_TITLE: "Renombrar horario",
  RENAME_DESCRIPTION:
    "El nombre identifica el horario en esta sección; no cambia los días, la hora ni la disciplina.",
  RENAME_SAVE: "Guardar",
  RENAME_SUCCESS: "Horario renombrado correctamente.",
  REMOVE_SERIES_ACTION: "Quitar horario",
  REMOVE_SERIES_TITLE: "¿Quitar el horario?",
  REMOVE_SERIES_DESCRIPTION:
    "Todas las clases activas de este horario dejarán de aparecer a partir de hoy. Las clases pasadas permanecerán visibles con su historial. Esta acción no se puede deshacer desde la aplicación.",
  REMOVE_SERIES_CONFIRM: "Quitar horario",
  REMOVE_SERIES_SUCCESS: "Horario quitado correctamente.",
  REMOVE_ALL_ACTION: "Quitar TODO lo futuro",
  REMOVE_ALL_TITLE: "¿Quitar TODO lo futuro?",
  REMOVE_ALL_DESCRIPTION:
    "Se quitarán TODOS los horarios de la sucursal a partir de hoy. Las clases únicas no se ven afectadas. Las clases pasadas permanecerán visibles con su historial. Esta acción no se puede deshacer desde la aplicación.",
  REMOVE_ALL_CONFIRM: "Sí, quitar todo lo futuro",
  REMOVE_ALL_SUCCESS:
    "Todos los horarios futuros fueron quitados correctamente.",
  ROSTER_ACTION: "Alumnos",
  ROSTER_BUTTON_ARIA_LABEL: (name: string, count: number) =>
    `Alumnos del grupo ${name} (${count})`,
  CLONE_ACTION: "Clonar al mes siguiente",
  CLONE_TITLE: "¿Clonar al mes siguiente?",
  CLONE_DESCRIPTION: (name: string, sourceMonth: string, targetMonth: string) =>
    `Se creará el grupo «${name}» para ${targetMonth} a partir de ${sourceMonth}, copiando los días, horarios, profesor y alumnos elegibles.`,
  CLONE_CONFIRM: "Clonar",
  CLONE_SUCCESS:
    "Grupo clonado al mes siguiente correctamente.",
  SKIPPED_TITLE: "Alumnos omitidos al clonar",
  SKIPPED_DESCRIPTION:
    "Estos alumnos no se copiaron al nuevo grupo porque no cumplen los requisitos actuales: alumno activo con inscripción mensual activa en la disciplina. Puede ajustar la lista del nuevo grupo a continuación.",
  SKIPPED_CLOSE: "Cerrar",
  EDIT_NEW_GROUP_ACTION: "Editar alumnos del nuevo grupo",
} as const

export const SCHEDULE_ONE_TIME_MESSAGES = {
  SECTION_TITLE: "Clases únicas",
  SECTION_DESCRIPTION:
    "Clases únicas próximas de la sucursal, ordenadas por fecha y hora.",
  EMPTY_STATE: "No hay clases únicas próximas registradas para esta sucursal.",
  DATE_LABEL: "Fecha",
  TIME_LABEL: "Hora",
  DISCIPLINE_LABEL: "Disciplina",
  TEACHER_LABEL: "Profesor",
  NO_TEACHER: "Sin profesor asignado",
  ROSTER_COUNT_LABEL: "Alumnos",
  ROSTER_BUTTON_ARIA_LABEL: (date: string, count: number) =>
    `Alumnos de la clase única del ${date} (${count})`,
} as const

/**
 * Session-level teacher assignment copy. The former conflict-detection
 * flow was removed (no schedule restrictions any more); only the action
 * labels used by the calendar session block remain in
 * TEACHER_CONFLICT_MESSAGES — the assignment sheet itself reads from
 * TEACHER_ASSIGN_MESSAGES.
 */
export const TEACHER_CONFLICT_MESSAGES = {
  ASSIGN_ACTION: "Asignar profesor",
  CHANGE_ACTION: "Cambiar profesor",
} as const

export const TEACHER_ASSIGN_MESSAGES = {
  ASSIGNED: "Profesor asignado correctamente.",
  ASSIGN_TITLE: "Asignar profesor a la sesión",
  ASSIGN_DESCRIPTION: "Seleccione el profesor que dará esta clase en la fecha indicada.",
  TEACHER_LABEL: "Profesor",
  TEACHER_PLACEHOLDER: "Seleccionar…",
  CONFIRM: "Asignar",
  INVALID_TEACHER:
    "El profesor debe tener un rol activo de profesor en esta sucursal.",
  UNAUTHORIZED:
    "Solo el propietario o un administrador de la sucursal puede gestionar los profesores.",
  SERIES_UPDATED: (count: number) =>
    count === 1
      ? "Profesor actualizado en 1 clase del grupo desde hoy. Las clases pasadas conservan al profesor anterior."
      : `Profesor actualizado en ${count} clases del grupo desde hoy. Las clases pasadas conservan al profesor anterior.`,
  ONE_TIME_UPDATED: "Profesor de la clase única actualizado correctamente.",
  SUBSTITUTION_CLEARED:
    "Sustitución eliminada: la clase vuelve al profesor habitual.",
  SUBSTITUTION_NONE: "No había sustitución para esta fecha.",
} as const

export const ENROLLMENT_MESSAGES = {
  BRANCH_REQUIRED: "Contexto de sucursal requerido.",
  MIN_ONE_DISCIPLINE: "Seleccioná al menos una disciplina.",
  DATE_FORMAT: "La fecha debe tener formato AAAA-MM-DD.",
  INVALID_DATE: "La fecha de inscripción no es válida.",
  DATE_NOT_FUTURE: "La fecha de inscripción no puede ser futura.",
  ENROLLED_LABEL: "Inscripto el",
  SUSPENDED_LABEL: "Suspendido",
  ACTIVE_LABEL: "Activo",
  SUSPEND_ACTION: "Suspender",
  REACTIVATE_ACTION: "Reactivar",
  DISCIPLINES_LABEL: "Disciplinas",
  ENROLLED_AT_LABEL: "Fecha de inscripción",
  HISTORY_TITLE: "Historial de inscripciones",
  EVENT_ENROLLED: "Inscripción",
  EVENT_SUSPENDED: "Suspensión",
  EVENT_REACTIVATED: "Reactivación",
  NO_DISCIPLINES: "Sin disciplinas activas.",
  ALREADY_ACTIVE: "La inscripción ya está activa.",
  ALREADY_SUSPENDED: "La inscripción ya está suspendida.",
  NOT_FOUND: "Inscripción no encontrada.",
  ALREADY_ENROLLED: "El estudiante ya está inscripto en esta disciplina.",
  BILLING_MODE_LABEL: "Modalidad de pago",
  BILLING_MODE_LABEL_INVALID: "La modalidad de pago debe ser mensual o por clase.",
  BILLING_MODE_MONTHLY: "Mensual",
  BILLING_MODE_PER_CLASS: "Por clase",
  BILLING_MODE_UNAUTHORIZED:
    "Solo los administradores de la sucursal pueden cambiar la modalidad de pago.",
  CHANGE_BILLING_MODE_ACTION: "Cambiar modalidad",
  BILLING_MODE_DIALOG_TITLE: "Cambiar modalidad de pago",
  BILLING_MODE_TO_PER_CLASS_DESCRIPTION:
    "El estudiante dejará de aparecer en las listas de clases actuales y futuras de esta disciplina y no podrá registrar pagos mensuales. Cobrará por clase asistida.",
  BILLING_MODE_TO_MONTHLY_DESCRIPTION:
    "El estudiante volverá a pagar mensualmente. El próximo vencimiento se fijará con el primer pago mensual.",
  BILLING_MODE_CONFIRM: "Cambiar modalidad",
  BILLING_MODE_CHANGED_TOAST: "Modalidad de pago actualizada.",
  BILLING_MODE_ROSTERS_REMOVED_TOAST: (count: number) =>
    `Se quitó al estudiante de ${count} ${count === 1 ? "lista de clase" : "listas de clase"}.`,
  EVENT_BILLING_MODE_CHANGED: "Cambio de modalidad",
} as const


export const ATTENDANCE_MESSAGES = {
  INVALID_CLASS_ID: "El identificador de la clase no es válido.",
  INVALID_STUDENT_ID: "El identificador del estudiante no es válido.",
  INVALID_DATE: "La fecha de la sesión no es válida.",
  MIN_ONE_RECORD: "Debe incluir al menos un registro de asistencia.",
  OBSERVATION_MAX: "La observación no puede superar los 500 caracteres.",
  INVALID_SESSION: "La sesión no es válida o no corresponde al día indicado.",
  FUTURE_SESSION: "No se puede registrar asistencia para una sesión futura.",
  SESSION_SUSPENDED: "No se puede registrar asistencia para una sesión suspendida.",
  INELIGIBLE_STUDENT: "Uno o más estudiantes no están inscriptos en esta sesión.",
  CORRECTION_WINDOW_EXCEEDED: "Solo se puede corregir la asistencia dentro de los 7 días posteriores a la sesión.",
  CAPTURE_WINDOW_EXCEEDED: "No se puede registrar asistencia para sesiones con más de 30 días de antigüedad.",
  LOAD_FAILURE: "No se pudo cargar la asistencia.",
  STUDENT_NOT_PER_CLASS: "El estudiante no tiene una inscripción por clase activa en esta disciplina.",
  STUDENT_ALREADY_ADDED: "El estudiante ya está registrado en esta sesión.",
} as const

export const LEVEL_MESSAGES = {
  INVALID_ID: "Identificador de nivel inválido.",
  INVALID_DISCIPLINE_ID: "Identificador de disciplina inválido.",
  NAME_REQUIRED: "El nombre del nivel es obligatorio.",
  NAME_MAX_LENGTH: "El nombre del nivel no puede superar 100 caracteres.",
  COLOR_MAX_LENGTH: "El color no puede superar 30 caracteres.",
  SORT_ORDER_NONNEG: "El orden debe ser un entero mayor o igual a 0.",
  REQUIRED_SESSIONS_NONNEG: "Las sesiones requeridas deben ser un entero mayor o igual a 0.",
  SORT_ORDER_TAKEN: "Ya existe un nivel con ese orden en esta disciplina.",
  NOT_FOUND: "El nivel no existe.",
  DISCIPLINE_MISMATCH: "El nivel no pertenece a la disciplina indicada.",
  PAGE_TITLE: "Niveles",
  PAGE_DESCRIPTION: "Catálogo de niveles de esta disciplina.",
  CREATE_LEVEL: "Crear nivel",
  EDIT_LEVEL: "Editar nivel",
  NAME_LABEL: "Nombre",
  COLOR_LABEL: "Color",
  SORT_ORDER_LABEL: "Orden",
  REQUIRED_SESSIONS_LABEL: "Sesiones requeridas",
  INITIAL_LEVEL_LABEL: "Nivel inicial",
  SET_AS_INITIAL_LEVEL: "Definir como nivel inicial",
  DEFINING_INITIAL_LEVEL: "Definiendo nivel inicial…",
  INITIAL_LEVEL_CONFIGURED: "Nivel inicial definido correctamente.",
  EMPTY_STATE: "Sin niveles configurados.",
  EMPTY_STATE_DESCRIPTION: "Cree un nivel para comenzar.",
  LOAD_FAILURE: "No se pudieron cargar los niveles.",
  SAVING: "Guardando…",
  MANAGE_LEVELS: "Niveles",
} as const

export const BRANCH_LEVEL_MESSAGES = {
  PAGE_TITLE: "Cinturones",
  PAGE_DESCRIPTION:
    "Defina las sesiones requeridas para promocionar entre cinturones en esta sucursal.",
  NO_BRANCH_CONTEXT:
    "No tiene una sucursal activa asignada. Contacte al administrador.",
  LOAD_FAILURE: "No se pudieron cargar los niveles.",
  INVALID_BRANCH_ID: "Identificador de sucursal inválido.",
  INVALID_LEVEL_ID: "Identificador de nivel inválido.",
  REQUIRED_SESSIONS_INVALID:
    "Las sesiones requeridas deben ser un entero entre 0 y 1000.",
  GENERAL_LABEL: "Clases default",
  BRANCH_LABEL: "Clases requeridas",
  CUSTOM_BADGE: "Personalizado",
  USE_GENERAL_ACTION: "Usar valor general",
  OWNER_MANAGED_NOTE:
    "Los nombres, los colores y el orden de los niveles los administra el propietario de la academia.",
  SAVE_SUCCESS: "Requisito de la sucursal guardado correctamente.",
  RESET_SUCCESS: "La sucursal usa el valor general nuevamente.",
  NO_LEVELS: "Sin niveles configurados.",
} as const

export const PROGRESS_MESSAGES = {
  INVALID_STUDENT_ID: "Identificador de estudiante inválido.",
  INVALID_DISCIPLINE_ID: "Identificador de disciplina inválido.",
  INVALID_LEVEL: "El nivel especificado no existe.",
  LEVEL_DISCIPLINE_MISMATCH: "El nivel no pertenece a la disciplina indicada.",
  PROMOTED_DATE_FORMAT: "La fecha de promoción debe tener formato AAAA-MM-DD.",
  PROMOTED_DATE_INVALID: "La fecha de promoción no es válida.",
  PROMOTED_DATE_NOT_FUTURE: "La fecha de promoción no puede ser futura.",
  OBSERVATIONS_MAX: "Las observaciones no pueden superar 500 caracteres.",
  PANEL_TITLE: "Progreso",
  CURRENT_LEVEL: "Nivel actual",
  NEXT_LEVEL: "Siguiente nivel",
  MAX_LEVEL: "Nivel máximo",
  NO_LEVEL_ASSIGNED: "Sin nivel asignado.",
  PROMOTION_REQUIREMENT_NOT_MET:
    "No se puede promover porque aún no se cumple el número de sesiones requeridas.",
  PROMOTION_CORRECTION_UNAVAILABLE:
    "No existe un nivel anterior registrado para corregir esta promoción.",
  PROMOTION_CORRECTION_OBSERVATION:
    "Corrección de promoción: se restauró el nivel anterior.",
  CORRECT_PROMOTION_ACTION: "Corregir última promoción",
  CORRECT_PROMOTION_TITLE: "¿Corregir la última promoción?",
  CORRECT_PROMOTION_DESCRIPTION:
    "El estudiante volverá al nivel registrado antes de la última promoción. El historial se conservará.",
  CORRECTING_PROMOTION: "Corrigiendo promoción…",
  CLASSES_TO_NEXT_LEVEL: (attended: string, required: string) =>
    `${attended} / ${required} clases`,
  ACCUMULATED_CLASSES: (attended: string) =>
    `${attended} clases acumuladas`,
  NO_PROGRESS: "Sin progreso registrado.",
  TIMELINE_TITLE: "Historial de promociones",
  PROMOTE_ACTION: "Promover",
  PROMOTE_TITLE: "Promover estudiante",
  PROMOTE_DESCRIPTION: "Seleccione el nivel al que desea promover al estudiante.",
  TARGET_LEVEL_LABEL: "Nivel destino",
  TARGET_LEVEL_PLACEHOLDER: "Seleccionar nivel…",
  OBSERVATIONS_LABEL: "Observaciones",
  OBSERVATIONS_PLACEHOLDER: "Nota opcional (máx. 500 caracteres)",
  READINESS_MEETS: "Cumple requisito de asistencia",
  READINESS_NOT_MEETS: "No cumple requisito de asistencia",
  ATTENDED_LABEL: "Sesiones asistidas",
  REQUIRED_LABEL: "Sesiones requeridas",
  PROMOTING: "Promoviendo…",
} as const

export const NOTES_MESSAGES = {
  INVALID_ID: "Identificador de nota inválido.",
  INVALID_STUDENT_ID: "Identificador de estudiante inválido.",
  INVALID_DISCIPLINE_ID: "Identificador de disciplina inválido.",
  CATEGORY_INVALID: "La categoría debe ser una de: tecnica, fisico, actitud, medica, general.",
  CONTENT_REQUIRED: "El contenido es obligatorio.",
  CONTENT_MAX: "El contenido no puede superar 2000 caracteres.",
  ALREADY_COMPLETED: "La nota ya está completada.",
  ALREADY_OPEN: "La nota ya está abierta.",
  PANEL_TITLE: "Bitácora",
  CREATE_NOTE: "Crear nota",
  CREATE_TITLE: "Nueva nota",
  CREATE_DESCRIPTION: "Agregue una nota al estudiante.",
  CATEGORY_LABEL: "Categoría",
  CATEGORY_PLACEHOLDER: "Seleccionar categoría…",
  CONTENT_LABEL: "Contenido",
  CONTENT_PLACEHOLDER: "Escriba el contenido de la nota…",
  DISCIPLINE_LABEL: "Disciplina",
  DISCIPLINE_PLACEHOLDER: "General (sin disciplina)",
  EMPTY_STATE: "Sin notas registradas.",
  COMPLETE_ACTION: "Completar",
  REOPEN_ACTION: "Reabrir",
  CREATED_AT_LABEL: "Creada",
  LAST_UPDATED_AT_LABEL: "Última actualización",
  REOPEN_CONFIRMATION_TITLE: "¿Reabrir esta nota?",
  REOPEN_CONFIRMATION_DESCRIPTION:
    "La nota volverá al estado abierto.",
  REOPEN_CONFIRM_ACTION: "Reabrir nota",
  REOPENING: "Reabriendo…",
  SAVING: "Guardando…",
  CATEGORY_TECNICA: "Técnica",
  CATEGORY_FISICO: "Físico",
  CATEGORY_ACTITUD: "Actitud",
  CATEGORY_MEDICA: "Médica",
  CATEGORY_GENERAL: "General",
  FILTER_ALL: "Todas",
  FILTER_OPEN: "Abiertas",
  FILTER_COMPLETED: "Completadas",
} as const

export const SESSION_INFO_MESSAGES = {
  TITLE: "Información de la sesión",
  DESCRIPTION: "Resumen de solo lectura de la sesión y su asistencia.",
  DISCIPLINE_LABEL: "Disciplina",
  DATE_LABEL: "Fecha",
  SCHEDULE_LABEL: "Horario",
  TEACHER_LABEL: "Profesor",
  NO_TEACHER: "Sin profesor asignado",
  TEACHER_PROFILE_UNAVAILABLE: "Perfil de profesor no disponible",
  SUBSTITUTE_LABEL: "Cobertura",
  SUBSTITUTE_VALUE: "Profesor sustituto",
  ONE_TIME_TYPE_LABEL: "Tipo de sesión",
  ONE_TIME_TYPE_VALUE: "Clase única",
  STATUS_LABEL: "Estado",
  SCHEDULED_STATUS: "Programada",
  COMPLETED_STATUS: "Realizada",
  SUSPENDED_STATUS: "Suspendida",
  SUSPENSION_CATEGORY_LABEL: "Categoría de suspensión",
  SUSPENSION_REASON_LABEL: "Motivo de suspensión",
  NOT_PROVIDED: "No especificado",
  ATTENDANCE_TITLE: "Asistencia",
  ATTENDANCE_SUMMARY: (recordCount: number, presentCount: number) =>
    `Registros: ${recordCount} · Presentes: ${presentCount}`,
  ATTENDANCE_NOT_REGISTERED: "La asistencia aún no ha sido registrada.",
  ATTENDANCE_EMPTY_PRESENT: "No se registraron estudiantes presentes.",
  ATTENDANCE_SUSPENDED: "Esta sesión está suspendida. La asistencia histórica no se considera válida.",
  PRESENT_STUDENTS_LABEL: "Estudiantes presentes",
  PRESENT_STUDENTS_LOADING: "Cargando estudiantes presentes…",
  PRESENT_STUDENTS_ERROR: "No se pudieron cargar los estudiantes presentes.",
} as const

export const ATTENDANCE_FORM_MESSAGES = {
  TITLE: "Asistencia",
  DESCRIPTION: "Registre la asistencia de los estudiantes para esta sesión.",
  PRESENT_LABEL: "Presente",
  OBSERVATION_LABEL: "Observación",
  OBSERVATION_PLACEHOLDER: "Nota opcional (máx. 500 caracteres)",
  SUBMIT: "Guardar asistencia",
  SAVING: "Guardando…",
  EMPTY_ELIGIBLE: "No hay estudiantes inscriptos para esta sesión.",
  SUSPENDED_NOTE: "La sesión está suspendida. No se puede registrar asistencia.",
  TAKE_ATTENDANCE: "Tomar asistencia",
  STATS_LABEL: "Asistencia",
  SOURCE_ROSTER: "Alumno del grupo",
  SOURCE_PER_CLASS: "Por clase",
  SOURCE_HISTORY: "Historial",
  ADD_PER_CLASS_TITLE: "Agregar alumno por clase",
  ADD_PER_CLASS_SEARCH_LABEL: "Buscar alumno por clase",
  ADD_PER_CLASS_SEARCH_PLACEHOLDER: "Nombre, apellido o cédula…",
  ADD_PER_CLASS_NO_RESULTS: "Sin candidatos disponibles.",
  ADD_PER_CLASS_REGISTER_PAYMENT: (amount: string) =>
    `Registrar pago de la clase (${amount})`,
  ADD_PER_CLASS_CONFIRM: "Agregar a la sesión",
  ADD_PER_CLASS_PRICE_UNSET:
    "Esta disciplina no tiene precio por clase configurado.",
  ADDING: "Agregando…",
  ADD_FAILURE: "No se pudo agregar el estudiante a la sesión.",
  CANDIDATES_SEARCH_LABEL: "Buscar por nombre, apellido o cédula",
  ATTENDED_STATE_PRESENT: "Presente",
  ATTENDED_STATE_ABSENT: "Ausente",
  ATTENDED_STATE_UNMARKED: "Sin registrar",
} as const

export const ATTENDANCE_TOAST = {
  SAVED: "Asistencia registrada correctamente.",
} as const

/** Trial-class guests (T7): server-action error copy. */
export const GUEST_MESSAGES = {
  INVALID_BRANCH_ID: "El identificador de la sucursal no es válido.",
  INVALID_CLASS_ID: "El identificador de la clase no es válido.",
  INVALID_DATE: "La fecha de la sesión no es válida.",
  INVALID_GUEST_ID: "El identificador del invitado no es válido.",
  INVALID_STUDENT_ID: "El identificador del estudiante no es válido.",
  FIRST_NAME_REQUIRED: "El nombre del invitado es obligatorio.",
  FIRST_NAME_MAX: "El nombre no puede superar 100 caracteres.",
  SURNAME_REQUIRED: "El apellido del invitado es obligatorio.",
  SURNAME_MAX: "El apellido no puede superar 100 caracteres.",
  PHONE_MAX: "El teléfono no puede superar 30 caracteres.",
  OBSERVATION_MAX: "La observación no puede superar 500 caracteres.",
  NOT_FOUND: "El invitado no existe o no pertenece a esta sucursal.",
  INVALID_SESSION: "La sesión no es válida o no corresponde al día indicado.",
  ALREADY_LINKED: "El invitado ya fue convertido en otro estudiante.",
  STUDENT_BRANCH_MISMATCH: "El estudiante no pertenece a esta sucursal.",
  REMOVE_WINDOW_EXCEEDED:
    "Solo el profesor que agregó al invitado puede quitarlo, dentro de los 30 días posteriores a la sesión.",
  ADD_SUCCESS: "Invitado agregado correctamente.",
  ADD_FAILURE: "No se pudo agregar el invitado.",
  REMOVE_SUCCESS: "Invitado quitado correctamente.",
  REMOVE_FAILURE: "No se pudo quitar el invitado.",
  LINK_SUCCESS: "Invitado convertido en estudiante correctamente.",
  LINK_FAILURE: "No se pudo vincular el invitado con el estudiante.",
  LOAD_CONVERSION_FAILURE: "No se pudieron cargar los datos del invitado.",
} as const

/** Trial-class guests (T7): attendance-sheet UI copy. */
export const GUEST_FORM_MESSAGES = {
  SECTION_TITLE: "Invitados (clase de prueba)",
  SECTION_DESCRIPTION:
    "Personas nuevas que asisten a una clase de prueba. No son estudiantes hasta convertirlas.",
  ADD_BUTTON: "Agregar invitado",
  FIRST_NAME_LABEL: "Nombre",
  SURNAME_LABEL: "Apellido",
  PHONE_LABEL: "Teléfono (opcional)",
  OBSERVATION_LABEL: "Observación (opcional)",
  ADD_ACTION: "Agregar",
  ADDING: "Agregando…",
  EMPTY: "Sin invitados en esta sesión.",
  CONVERTED_BADGE: "Convertido",
  CONVERT_ACTION: "Convertir en alumno",
  REMOVE_ACTION: "Quitar",
  ARIA_GUEST_LIST: "Invitados de la sesión",
  OBSERVATION_PREFIX: "Observación",
  PHONE_PREFIX: "Teléfono",
} as const

export const PAYMENT_MESSAGES = {
  ENROLLMENT_NOT_FOUND: "Inscripción no encontrada.",
  CLASS_PRICE_NOT_SET: "El precio por clase no está configurado para esta disciplina.",
  REGISTER_MONTHLY_TITLE: "Registrar pago mensual",
  REGISTER_MONTHLY_DESCRIPTION: "Registre un pago para el período elegido.",
  REGISTER_CLASS_TITLE: "Registrar pago por clase",
  REGISTER_CLASS_DESCRIPTION: "Cobre el valor de una clase individual.",
  CONFIGURE_PRICE_TITLE: "Configurar precio por clase",
  CONFIGURE_PRICE_DESCRIPTION: "Establezca o elimine el precio por clase de esta disciplina.",
  AMOUNT_LABEL: "Monto",
  CALENDAR_YEAR_LABEL: "Año calendario",
  FIRST_MONTH_LABEL: "Primer mes",
  LAST_MONTH_LABEL: "Último mes",
  MONTH_RANGE_INVALID: "El mes final debe ser igual o posterior al mes inicial.",
  PERIOD_END_AFTER_START: "El fin del período debe ser posterior al inicio.",
  PERIOD_MAX_24_MONTHS: "El período no puede abarcar más de 24 meses calendario.",
  COVERAGE_MONTH_COUNT: (count: number) => `${count} ${count === 1 ? "mes cubierto" : "meses cubiertos"}.`,
  PERIOD_OVERLAP: "El período se superpone con otro pago mensual de esta inscripción.",
  CORRECTION_WINDOW_EXCEEDED: "El plazo configurado para corregir o eliminar este pago ya venció.",
  PAYMENT_NOT_FOUND: "Pago no encontrado.",
  CORRECTIONS_LOCKED: "Solo los administradores activos de la sucursal pueden corregir o eliminar pagos.",
  CORRECTION_TITLE: "Corregir pago",
  DELETE_TITLE: "¿Eliminar este pago?",
  DELETE_DESCRIPTION: "La eliminación es permanente y se conservará el registro de auditoría.",
  DELETE_ACTION: "Eliminar",
  LOCKED_REASON: "Solo los administradores de la sucursal pueden modificar pagos.",
  ACTIONS_LABEL: "Acciones",
  EDIT_ACTION: "Corregir",
  SETTINGS_LINK: "Configuración de pagos",
  SETTINGS_TITLE: "Configuración de pagos",
  SETTINGS_DESCRIPTION: "Defina el vencimiento mensual y el plazo de corrección de pagos para esta sucursal.",
  DUE_DAY_LABEL: "Día de vencimiento mensual",
  EDIT_WINDOW_LABEL: "Días para corregir o eliminar",
  GRACE_DAYS_LABEL: "Días de gracia",
  GRACE_DAYS_HELP: "Días de tolerancia después del vencimiento antes de proponer la suspensión por falta de pago.",
  SETTINGS_SAVED: "Configuración de pagos actualizada correctamente.",
  SETTINGS_UNAVAILABLE: "No se pudo cargar la configuración de pagos.",
  SAVE_SETTINGS: "Guardar configuración",
  INVALID_DATE: "Ingrese una fecha válida con formato AAAA-MM-DD.",
  NOTE_LABEL: "Nota",
  NOTE_PLACEHOLDER: "Nota opcional (máx. 500 caracteres)",
  PAYMENT_DATE_LABEL: "Fecha de pago",
  CLASS_DATE_LABEL: "Fecha de clase",
  PRICE_LABEL: "Precio por clase",
  PRICE_PLACEHOLDER: "Dejar vacío para desactivar",
  DISCIPLINE_LABEL: "Disciplina",
  DISCIPLINE_PLACEHOLDER: "Seleccionar disciplina…",
  STUDENT_LABEL: "Estudiante",
  SUCCESS_MONTHLY: "Pago mensual registrado correctamente.",
  SUCCESS_CLASS: "Pago por clase registrado correctamente.",
  SUCCESS_PRICE: "Precio actualizado correctamente.",
  HISTORY_TITLE: "Historial de pagos",
  TYPE_MONTHLY: "Mensual",
  TYPE_CLASS: "Por clase",
  NO_PAYMENTS: "Sin pagos registrados.",
  PERIOD_LABEL: "Período",
  SAVING: "Guardando…",
  REGISTER_ACTION: "Registrar",
  CHARGE_CLASS: "Cobrar clase",
  ALREADY_PAID: "Este estudiante ya tiene un pago registrado para esta clase.",
  OCCURRENCE_EXCLUSIVE: "Indique solo una clase: programada o única.",
  MONTHLY_NOT_ALLOWED_FOR_PER_CLASS:
    "No se pueden registrar pagos mensuales en una inscripción por clase.",
} as const

/** Monthly payment validation (admin bulk suspension) messages. */
export const PAYMENT_VALIDATION_MESSAGES = {
  SUSPEND_LIST_EMPTY: "Seleccione al menos una inscripción para suspender.",
  SUSPEND_LIST_TOO_LONG: "Puede suspender hasta 200 inscripciones por vez.",
  SUSPEND_LIST_DUPLICATED: "La lista de inscripciones contiene elementos duplicados.",
  SUSPEND_LIST_INVALID_ID: "Identificador de inscripción inválido.",
  NOTES_TOO_LONG: "La nota no puede exceder 500 caracteres.",
  SUSPEND_STALE_LIST:
    "Algunas inscripciones ya no cumplen las condiciones para suspender. Actualice la lista e inténtelo nuevamente.",
  PAGE_TITLE: "Validación mensual",
  PAGE_DESCRIPTION: (monthName: string) =>
    `Clasificación de las inscripciones activas correspondientes a ${monthName}.`,
  BACK_LINK: "Volver a pagos",
  NOT_AUTHORIZED:
    "Solo los administradores de la sucursal pueden revisar y suspender inscripciones por falta de pago.",
  SERVICE_UNAVAILABLE: "No se pudo cargar la validación mensual.",
  UP_TO_DATE: "Al día",
  IN_GRACE: "En gracia",
  TO_SUSPEND: "A suspender",
  SUSPENDED_THIS_MONTH: "Suspendidas este mes",
  STUDENT: "Estudiante",
  DISCIPLINE: "Disciplina",
  DUE_DATE: "Fecha de vencimiento",
  DAYS_OVERDUE: "Días de atraso",
  GRACE_DEADLINE: "Fin de gracia",
  SUSPENDED_DATE: "Fecha",
  PERFORMED_BY: "Realizado por",
  CURRENT_STATE: "Estado actual",
  FALLBACK_DASH: "—",
  NEXT_DUE_DATE: "Próximo vencimiento",
  NO_PAYMENTS_REGISTERED: "Sin pagos registrados",
  SUSPENDED_BADGE: "Suspendida",
  REACTIVATED_BADGE: "Reactivada",
  SELECT_ALL_ARIA: "Seleccionar todas las inscripciones a suspender",
  SELECT_ROW_ARIA: (studentName: string, disciplineName: string) =>
    `Seleccionar ${studentName} – ${disciplineName}`,
  SUSPEND_SELECTED: (count: string) => `Suspender seleccionadas (${count})`,
  SUSPEND_DIALOG_TITLE: "Suspender inscripciones por falta de pago",
  SUSPEND_DIALOG_DESCRIPTION: (count: string) =>
    `Se suspenderán ${count} inscripciones por falta de pago. El estudiante conserva sus demás inscripciones; la reactivación es manual desde el detalle del estudiante.`,
  NOTES_LABEL: "Nota (opcional)",
  SUSPENDING: "Suspendiendo…",
  CONFIRM_SUSPEND: "Suspender inscripciones",
  SUSPEND_FAILURE: "No se pudieron suspender las inscripciones seleccionadas.",
  SUSPEND_SUCCESS: (count: string) =>
    `${count} inscripciones suspendidas por falta de pago.`,
  TO_SUSPEND_CAPTION:
    "Inscripciones fuera del plazo de gracia. Seleccione las que desea suspender.",
  TO_SUSPEND_EMPTY: "No hay inscripciones para suspender.",
  IN_GRACE_CAPTION: "Inscripciones con atraso dentro del plazo de gracia.",
  IN_GRACE_EMPTY: "No hay inscripciones en gracia.",
  SUSPENDED_MONTH_CAPTION:
    "Inscripciones suspendidas por falta de pago durante el mes actual.",
  SUSPENDED_MONTH_EMPTY: "No hay suspensiones registradas este mes.",
  UP_TO_DATE_CAPTION: "Inscripciones al día con sus pagos.",
  UP_TO_DATE_EMPTY: "No hay inscripciones al día.",
} as const

/** Student detail (resumen) page composition messages. */
export const STUDENT_DETAIL_MESSAGES = {
  ACTIVE_BADGE: "Activo",
  INACTIVE_BADGE: "Inactivo",
  AGE_LABEL: (years: string) => `${years} años`,
  TAB_NOTES: "Bitácora",
  TAB_PAYMENTS: "Pagos",
  TAB_PROGRESS: "Progreso",
  TAB_ENROLLMENTS: "Inscripciones",
  TAB_WITH_COUNT: (label: string, count: string) => `${label} (${count})`,
  PAID_THROUGH_LABEL: "Pagado hasta",
  NO_MONTHLY_PAYMENTS: "Sin pagos mensuales",
  MORE_ACTIONS_ARIA: (discipline: string) => `Más acciones de ${discipline}`,
  MONTHLY_PAYMENT_ARIA: (discipline: string) =>
    `Registrar pago mensual de ${discipline}`,
  CLASS_PAYMENT_ARIA: (discipline: string) => `Cobrar clase de ${discipline}`,
  PROMOTE_ARIA: (discipline: string) => `Promover en ${discipline}`,
  VIEW_ALL_ACTION: (count: string) => `Ver todo (${count})`,
  VIEW_LESS_ACTION: "Ver menos",
  ENROLLMENTS_EMPTY: "Sin eventos de inscripción.",
} as const

export const PAYMENT_CONSOLE_MESSAGES = {
  HEADING: "Pagos en espera",
  DESCRIPTION: "Resumen mensual de pagos y seguimiento de inscripciones pendientes.",
  CURRENT_PERIOD: "Período actual",
  DISCIPLINE_FILTER_LABEL: "Filtrar pagos por disciplina",
  ALL_DISCIPLINES: "Todas las disciplinas",
  TOTAL_COLLECTED: "Total cobrado",
  MONTHLY_PAYMENT_COUNT: "Pagos mensuales",
  CLASS_PAYMENT_COUNT: "Pagos por clase",
  OVERDUE_COUNT: "Pagos en espera",
  REQUIRES_ACTION: "Inscripciones con pago pendiente",
  RECENT_ACTIVITY: "Actividad reciente",
  OVERDUE_CAPTION: "Inscripciones con pago pendiente.",
  ACTIVITY_CAPTION: "Pagos registrados durante el período actual.",
  STUDENT: "Estudiante",
  DISCIPLINE: "Disciplina",
  DUE_DATE: "Fecha de vencimiento",
  DATE: "Fecha",
  AMOUNT: "Monto",
  TYPE: "Tipo",
  ACTIONS: "Acciones",
  EMPTY_OVERDUE: "No hay inscripciones con pago pendiente.",
  EMPTY_ACTIVITY: "No hay pagos registrados en este período.",
  CURRENCY_CODE: "USD",
} as const

export const OVERDUE_MESSAGES = {
  NO_BRANCH_CONTEXT: "No tiene una sucursal activa asignada. Contacte al administrador.",
  CARD_TITLE: "Pagos en espera",
  CARD_DESCRIPTION: "Inscripciones con pago pendiente.",
  LIST_TITLE: "Inscripciones con pago pendiente",
  LIST_DESCRIPTION: "Inscripciones con fecha de pago pendiente.",
  STUDENT_NAME: "Estudiante",
  DISCIPLINE: "Disciplina",
  DUE_DATE: "Fecha de vencimiento",
  EMPTY_STATE: "No hay inscripciones con pago pendiente.",
  COUNT_ARIA_LABEL: (count: string) =>
    `${count} inscripciones con pago pendiente`,
  PAGE_TITLE: "Pagos en espera",
  PAGE_DESCRIPTION: "Gestión de pagos en espera.",
  PRICING_SECTION_TITLE: "Configuración de precios por clase",
  PRICING_SECTION_DESCRIPTION: "Establezca el precio por clase individual de cada disciplina.",
  CURRENT_PRICE: "Precio actual",
  NO_PRICE: "Sin precio",
} as const


export const PROFILE_MESSAGES = {
  PAGE_TITLE: "Mi perfil",
  PAGE_DESCRIPTION: "Actualice sus datos personales.",
  SETUP_DESCRIPTION: "Complete sus datos personales para continuar.",
  COMPLETE_SETUP: "Completar perfil",
  SAVING: "Guardando…",
  LOAD_FAILURE: "No se pudo cargar su perfil. Inténtelo nuevamente.",
} as const