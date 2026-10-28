/**
 * Browser-side signals for the Conducta page.
 *
 * The "Registrar" sheet and the filtered records list are siblings rendered by
 * a server page, so a successful registration cannot travel back as a prop.
 * The sheet announces it and the list re-reads the student it is filtering,
 * because the server refresh that follows only updates the unfiltered list.
 *
 * SSR-safe: every helper no-ops without a window.
 */

const CONDUCT_RECORD_CREATED_EVENT = "conduct:record-created"

export function notifyConductRecordCreated(): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(new Event(CONDUCT_RECORD_CREATED_EVENT))
}

export function onConductRecordCreated(listener: () => void): () => void {
  if (typeof window === "undefined") return () => {}
  window.addEventListener(CONDUCT_RECORD_CREATED_EVENT, listener)
  return () => window.removeEventListener(CONDUCT_RECORD_CREATED_EVENT, listener)
}
