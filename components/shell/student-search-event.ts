/**
 * Window event the header control dispatches to open the student search
 * palette. Kept in its own module so the header never imports the palette (and
 * its server action) just to render a button.
 */
export const OPEN_STUDENT_SEARCH_EVENT = "enoeda:open-student-search"
