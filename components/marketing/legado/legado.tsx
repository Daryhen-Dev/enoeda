import Image from "next/image"
import Link from "next/link"

import enoedaPortrait from "@/assets/enoeda-portrait.webp"
import styles from "@/components/marketing/marketing.module.css"
import legadoStyles from "./legado.module.css"

const SECTION_LABEL_CLASSES =
  "font-marketing-body text-sm font-bold uppercase tracking-[0.18em] text-marketing-accent"

const SECTION_TITLE_CLASSES =
  "font-marketing-display text-[clamp(2.75rem,5.5vw,5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground"

const BODY_TEXT_CLASSES =
  "font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6"

const SECTION_CLASSES =
  "border-b-2 border-marketing-section-border px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"

interface NarrativeSection {
  id: string
  label: string
  title: string
  paragraph: string
}

/**
 * Four answers, one paragraph each: who he was, why "the Tiger", what he did
 * and his philosophy. His death is a coda inside the closing block, in body
 * type, because a display heading over a death reads as indifference.
 * Sources: JKA England masters page, KUGB memorial, Shotokan Karate Magazine
 * issue 76 (2003) for the date, and the dojo's own validated material.
 */
const SECTIONS: NarrativeSection[] = [
  {
    id: "quien-es",
    label: "QUIÉN FUE",
    title: "DE KYUSHU AL TATAMI.",
    paragraph:
      "Keinosuke Enoeda nació el 4 de julio de 1935 en Fukuoka, en la isla de Kyushu, en una familia de linaje samurái. De joven fue judoca —2º dan a los 16 años— hasta que una demostración en la Universidad de Takushoku lo pasó al karate: ahí se graduó en economía y ahí empezó el resto de su vida.",
  },
  {
    id: "tigre",
    label: "EL APODO",
    title: "POR QUÉ LO LLAMABAN TORA.",
    paragraph:
      "Se formó en la clase de instructores de la JKA bajo Masatoshi Nakayama y Gichin Funakoshi, y llegó a ser campeón de Japón de kumite. Fue Nakayama quien lo llamó Tora —tigre— por la fiereza con la que peleaba y entrenaba.",
  },
  {
    id: "que-hizo",
    label: "QUÉ HIZO",
    title: "LLEVÓ EL SHOTOKAN A EUROPA.",
    paragraph:
      "En 1965 la JKA lo envió a Europa junto a Taiji Kase, Hirokazu Kanazawa y Hiroshi Shirai. Se quedó en Inglaterra: enseñó en el Red Triangle Dojo de Liverpool, entrenaba a las 7 de la mañana en Sefton Park y, como Instructor Jefe de la KUGB, formó a la generación que levantó el karate británico.",
  },
  {
    id: "filosofia",
    label: "SU FILOSOFÍA",
    title: "EL TALENTO SIN PRÁCTICA DIARIA NO SIGNIFICA NADA.",
    paragraph:
      "No enseñaba con discursos: aparecía todos los días, corregía uno por uno y esperaba de sus alumnos lo mismo que exigía de sí mismo. Repetición, intensidad y ejemplo; la frase que más se le cita era, literalmente, su rutina.",
  },
]

export function MarketingLegado() {
  return (
    <main className={legadoStyles.legadoMain}>
      <section
        aria-labelledby="legado-hero-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-20 lg:px-16 lg:py-20"
      >
        <div className="mx-auto grid max-w-360 gap-12 lg:grid-cols-12 lg:items-end lg:gap-8">
          <div className="lg:col-span-7">
            <p className={SECTION_LABEL_CLASSES}>EL LEGADO // KEINOSUKE ENOEDA</p>
            <h1
              className="mt-6 font-marketing-display text-[clamp(4.75rem,12vw,10.5rem)] leading-[0.76] tracking-[-0.025em] text-marketing-foreground"
              id="legado-hero-heading"
            >
              EL TIGRE.
            </h1>
            <div className="mt-8 max-w-2xl border-l-2 border-marketing-foreground pl-5">
              <p className="font-marketing-display text-3xl leading-[0.95] tracking-[0.02em] text-marketing-foreground sm:text-4xl">
                KEINOSUKE ENOEDA
              </p>
              <p className="mt-3 font-marketing-body text-sm font-bold uppercase leading-5 tracking-[0.1em] text-marketing-foreground sm:text-base">
                1935 – 2003 · 9º Dan · Campeón de Japón JKA · Instructor Jefe de la KUGB
              </p>
              <p className={`mt-4 ${BODY_TEXT_CLASSES}`}>Nuestro dojo lleva su nombre.</p>
            </div>
          </div>

          <figure className={`mt-2 lg:col-span-5 lg:mt-0 ${legadoStyles.heroPortrait}`}>
            <div className={legadoStyles.heroPortraitFrame}>
              <Image
                alt="Keinosuke Enoeda con el gi blanco y el cinturón negro, brazos cruzados"
                className={legadoStyles.heroPortraitImage}
                sizes="(min-width: 1024px) 40vw, 100vw"
                src={enoedaPortrait}
              />
            </div>
          </figure>
        </div>
      </section>

      {SECTIONS.map((section, index) => (
        <section
          aria-labelledby={`${section.id}-heading`}
          className={`${SECTION_CLASSES} ${index % 2 === 0 ? "bg-marketing-surface" : "bg-marketing-muted"}`}
          id={section.id}
          key={section.id}
        >
          <div className="mx-auto max-w-360">
            <p className={SECTION_LABEL_CLASSES}>{section.label}</p>
            <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id={`${section.id}-heading`}>
              {section.title}
            </h2>
            <p className={`mt-8 max-w-3xl ${BODY_TEXT_CLASSES}`}>{section.paragraph}</p>
          </div>
        </section>
      ))}

      <section
        aria-labelledby="legado-cta-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="legado-cta"
      >
        <div className="mx-auto max-w-360">
          <p className="max-w-2xl border-l-2 border-marketing-accent pl-5 font-marketing-body text-sm leading-6 text-marketing-menu-foreground sm:text-base">
            Keinosuke Enoeda murió el 29 de marzo de 2003, a los 67 años. Su nombre sigue en cada
            dojo que entrena como él enseñaba —incluido el nuestro.
          </p>

          <div className="mt-14 grid gap-8 lg:grid-cols-12 lg:items-end lg:mt-20">
            <h2
              className={`font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground lg:col-span-8`}
              id="legado-cta-heading"
            >
              ENTRENA
              <br />
              EN SU NOMBRE.
            </h2>
            <div className="flex flex-col gap-4 lg:col-span-4 lg:mb-1">
              <p className={`max-w-md ${BODY_TEXT_CLASSES}`}>
                Técnica, constancia y presencia, todos los días. Esa es la premisa que heredamos.
              </p>
              <Link
                className={`${styles.hardShadow} inline-flex min-h-11 items-center justify-center border-2 border-marketing-surface bg-marketing-accent px-6 py-4 font-marketing-display text-2xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0`}
                href="/#sedes"
              >
                CONOCER LAS SEDES
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}
