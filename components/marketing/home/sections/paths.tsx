import Link from "next/link"

import {
  MARKETING_WHATSAPP_KARATE_URL,
  MARKETING_WHATSAPP_URL,
} from "@/components/marketing/shared/contact"
import styles from "@/components/marketing/marketing.module.css"

interface PathEntry {
  title: string
  description: string
  href: string
  /** Internal anchors render as SPA links; WhatsApp stays a plain anchor. */
  internal: boolean
}

/**
 * The two disciplines are the decision the visitor came to make; the other
 * four entries are the rest of the dojo. Copy comes verbatim from the dojo's
 * own brief.
 */
const DISCIPLINES: Array<PathEntry> = [
  {
    title: "Karate-do",
    description: "Kihon, kata, kumite, grados y competición.",
    href: MARKETING_WHATSAPP_KARATE_URL,
    internal: false,
  },
  {
    title: "Kickboxing",
    description: "Técnica, acondicionamiento físico y combate.",
    href: "/kickboxing",
    internal: true,
  },
]

const DOJO_INDEX: Array<PathEntry> = [
  {
    title: "Legado del Sensei Keinosuke Enoeda",
    description: "Biografía, trayectoria, filosofía y legado histórico.",
    href: "/#dojo",
    internal: true,
  },
  {
    title: "Nuestro equipo",
    description: "Tu trayectoria, instructores y comunidad Enoeda.",
    href: "/#maestros",
    internal: true,
  },
  {
    title: "Sedes y horarios",
    description: "Ubicaciones, clases, edades y horarios vigentes.",
    href: "/#sedes",
    internal: true,
  },
  {
    title: "Eventos y contacto",
    description: "Copa Enoeda, actividades, WhatsApp e inscripciones.",
    href: MARKETING_WHATSAPP_URL,
    internal: false,
  },
]

function PathCard({ entry }: { entry: PathEntry }) {
  const cardClasses = `${styles.pathsCard} group`
  const inner = (
    <>
      <span className={styles.pathsCardTitle}>{entry.title}</span>
      <span className={styles.pathsCardDescription}>{entry.description}</span>
      <span aria-hidden="true" className={styles.pathsCardArrow}>
        →
      </span>
    </>
  )

  return entry.internal ? (
    <Link className={cardClasses} href={entry.href}>
      {inner}
    </Link>
  ) : (
    <a className={cardClasses} href={entry.href} rel="noopener" target="_blank">
      {inner}
    </a>
  )
}

export function MarketingPaths() {
  return (
    <section
      aria-labelledby="paths-heading"
      className={`${styles.anchorTarget} border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
      id="paths"
    >
      <div className="mx-auto max-w-360">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2
            className="font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground lg:col-span-8"
            id="paths-heading"
          >
            DOS DISCIPLINAS.
            <br />
            UN MISMO DOJO.
          </h2>
          <p className="max-w-md font-marketing-body text-base leading-6 text-marketing-foreground lg:col-span-4 lg:mb-1">
            Elige tu disciplina y conoce todo lo que ENOEDA Dojo tiene para ti: su historia, su
            gente y sus sedes.
          </p>
        </div>

        <div className={styles.pathsDisciplines}>
          {DISCIPLINES.map((entry) => (
            <PathCard entry={entry} key={entry.title} />
          ))}
        </div>

        <h3 className={`${styles.pathsIndexLabel} font-marketing-body`}>
          Y TODO EL DOJO
        </h3>
        <ul className={styles.pathsIndex}>
          {DOJO_INDEX.map((entry) => (
            <li className={styles.pathsIndexItem} key={entry.title}>
              <PathCard entry={entry} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
