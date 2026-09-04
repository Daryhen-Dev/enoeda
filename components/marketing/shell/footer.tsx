import {
  MARKETING_EMAIL,
  MARKETING_FACEBOOK_URL,
  MARKETING_INSTAGRAM_URL,
  MARKETING_TIKTOK_URL,
  MARKETING_WHATSAPP_DISPLAY_NUMBER,
  MARKETING_WHATSAPP_URL,
} from "@/components/marketing/shared/contact"
import styles from "@/components/marketing/marketing.module.css"

const FOOTER_SOCIAL_LINKS = [
  {
    accessibleLabel: "Visitar el Instagram de ENOEDA Dojo",
    href: MARKETING_INSTAGRAM_URL,
    label: "Instagram",
  },
  {
    accessibleLabel: "Visitar el Facebook de ENOEDA Dojo",
    href: MARKETING_FACEBOOK_URL,
    label: "Facebook",
  },
  {
    accessibleLabel: "Visitar el TikTok de ENOEDA Dojo",
    href: MARKETING_TIKTOK_URL,
    label: "TikTok",
  },
] as const

const SECONDARY_LINK_CLASS =
  "inline-flex min-h-11 items-center font-marketing-body text-sm font-bold uppercase tracking-[0.1em] text-marketing-menu-foreground transition-colors hover:text-marketing-menu-border focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-menu-border motion-reduce:transition-none"

export function MarketingFooter() {
  return (
    <footer className="relative isolate overflow-hidden rounded-b-[1.75rem] border-t-2 border-marketing-menu-border bg-marketing-surface px-5 py-12 sm:px-8 sm:py-16 lg:px-16 lg:py-20">
      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-12 -right-2 font-marketing-display text-[clamp(9rem,24vw,20rem)] leading-none tracking-[0.02em] text-marketing-muted opacity-75"
      >
        ENOEDA
      </span>

      <div className="relative z-10 mx-auto grid max-w-360 gap-14 lg:grid-cols-12 lg:gap-8">
        <div className="lg:col-span-7">
          <p className="max-w-3xl font-marketing-display text-[clamp(4.25rem,8vw,7.5rem)] leading-[0.78] tracking-[-0.025em] text-marketing-menu-foreground">
            TU PRÁCTICA
            <br />
            EMPIEZA HOY.
          </p>
          <p className="mt-6 max-w-md font-marketing-body text-lg leading-7 text-marketing-menu-foreground">
            Escríbenos para consultar por la sede elegida y dar tu primer
            paso en el dojo.
          </p>
          <a
            aria-label={`Escribir por WhatsApp al ${MARKETING_WHATSAPP_DISPLAY_NUMBER}`}
            className={`${styles.footerPrimaryCta} mt-9 inline-flex min-h-14 w-full flex-col justify-center border-2 border-marketing-surface bg-marketing-accent px-6 py-4 font-marketing-display text-2xl leading-none tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-menu-border motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0 sm:w-auto sm:min-w-80`}
            href={MARKETING_WHATSAPP_URL}
          >
            <span>ESCRIBIR POR WHATSAPP</span>
            <span className="mt-2 font-marketing-body text-xs font-bold uppercase tracking-[0.14em]">
              {MARKETING_WHATSAPP_DISPLAY_NUMBER}
            </span>
          </a>
        </div>

        <div className="grid content-end gap-8 lg:col-span-4 lg:col-start-9">
          <div className="border-t-2 border-marketing-menu-border pt-5">
            <p className="font-marketing-body text-xs font-bold uppercase tracking-[0.16em] text-marketing-menu-border">
              CONTACTO DIRECTO
            </p>
            <a
              aria-label={`Enviar correo a ${MARKETING_EMAIL}`}
              className={`${SECONDARY_LINK_CLASS} mt-3 max-w-full break-all`}
              href={`mailto:${MARKETING_EMAIL}`}
            >
              {MARKETING_EMAIL}
            </a>
          </div>

          <nav
            aria-label="Redes sociales de ENOEDA Dojo"
            className="border-t-2 border-marketing-menu-border pt-5"
          >
            <p className="font-marketing-body text-xs font-bold uppercase tracking-[0.16em] text-marketing-menu-border">
              SÍGUENOS
            </p>
            <ul className="mt-3 flex flex-wrap gap-x-6 gap-y-1">
              {FOOTER_SOCIAL_LINKS.map((item) => (
                <li key={item.href}>
                  <a
                    aria-label={item.accessibleLabel}
                    className={SECONDARY_LINK_CLASS}
                    href={item.href}
                    rel="noreferrer"
                    target="_blank"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </div>

      <div className="relative z-10 mx-auto mt-16 flex max-w-360 flex-col gap-2 border-t-2 border-marketing-foreground/30 pt-5 font-marketing-body text-xs font-bold uppercase tracking-[0.1em] text-marketing-menu-border sm:mt-20 sm:flex-row sm:items-center sm:justify-between">
        <span>© 2026 ENOEDA DOJO</span>
        <span>KARATE · KICKBOXING · DISCIPLINA</span>
      </div>
    </footer>
  )
}
