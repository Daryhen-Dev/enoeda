import {
  MARKETING_EMAIL,
  MARKETING_WHATSAPP_DISPLAY_NUMBER,
  MARKETING_WHATSAPP_URL,
} from "@/components/marketing/contact"

const FOOTER_LINKS = [
  {
    accessibleLabel: `Escribir por WhatsApp al ${MARKETING_WHATSAPP_DISPLAY_NUMBER}`,
    href: MARKETING_WHATSAPP_URL,
    label: `WhatsApp ${MARKETING_WHATSAPP_DISPLAY_NUMBER}`,
  },
  {
    accessibleLabel: `Enviar correo a ${MARKETING_EMAIL}`,
    href: `mailto:${MARKETING_EMAIL}`,
    label: MARKETING_EMAIL,
  },
] as const

export function MarketingFooter() {
  return (
    <footer className="relative isolate overflow-hidden rounded-b-[1.75rem] border-t-2 border-marketing-menu-border bg-marketing-surface px-5 py-6 sm:px-8 lg:px-9">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -right-2 -top-8 font-marketing-display text-[clamp(8rem,22vw,17rem)] leading-none tracking-[0.02em] text-marketing-muted opacity-80"
      >
        ENOEDA
      </span>

      <div className="relative z-10 mx-auto flex max-w-360 flex-col gap-6 sm:flex-row sm:items-center sm:justify-between sm:gap-8">
        <div>
          <p className="font-marketing-display text-lg leading-none tracking-[0.04em] text-marketing-menu-foreground sm:text-xl">
            ENOEDA DOJO
          </p>
          <p className="mt-3 font-marketing-body text-[0.68rem] font-bold uppercase tracking-[0.08em] text-marketing-menu-border">
            © 2026 ENOEDA DOJO. DISCIPLINA Y FUERZA.
          </p>
        </div>

        <ul className="flex flex-wrap gap-x-6 gap-y-2 font-marketing-body text-[0.68rem] font-bold uppercase tracking-[0.08em] text-marketing-menu-foreground sm:justify-end">
          {FOOTER_LINKS.map((item) => (
            <li key={item.href}>
              <a
                aria-label={item.accessibleLabel}
                className="inline-flex min-h-11 items-center transition-colors hover:text-marketing-menu-border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"
                href={item.href}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  )
}
