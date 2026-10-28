import Link from "next/link"

import {
  MARKETING_WHATSAPP_URL,
} from "@/components/marketing/shared/contact"
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
  paragraphs: string[]
}

const SECTIONS: NarrativeSection[] = [
  {
    id: "primeros-anios",
    label: "LOS PRIMEROS AÑOS",
    title: "EL JUDO LO LLEVÓ AL KARATE.",
    paragraphs: [
      "Keinosuke Enoeda nació el 4 de julio de 1935 en Kyushu, al sur de Japón. De joven practicó los deportes populares de su país: béisbol, kendo y judo. En judo destacó de manera especial: a los 16 años ya era 2º dan.",
      "El destino lo llevó a una demostración de karate en la Universidad de Takushoku: quedó tan impresionado que canalizó toda su energía en este arte. Se inscribió en la universidad, se unió a la sección de karate y en dos años obtuvo su shodan (1º dan); dos años más tarde era el capitán del club. Se graduó en economía.",
    ],
  },
  {
    id: "jka",
    label: "LA ESCUELA DE LA JKA",
    title: "FUNAKOSHI. NAKAYAMA. KASE.",
    paragraphs: [
      "Tras graduarse, ingresó a la clase de instructores de la Asociación Japonesa de Karate (JKA), donde entrenó durante tres años bajo la dirección principal de Masatoshi Nakayama, instructor jefe de la JKA. Uno de sus maestros fue Gichin Funakoshi, fundador del karate Shotokan, cuya enseñanza fue una gran inspiración para él. También entrenó kumite bajo la dirección de Taiji Kase, junto a otros grandes instructores de la época.",
      "Esa calidad de instrucción, combinada con una determinación feroz, lo moldeó como uno de los más grandes competidores e instructores que ha dado Japón.",
      "En 1961 sostuvo un combate memorable contra Keigo Abe, ganando por decisión tras seis prórrogas. En 1963 conquistó el Campeonato de Japón de la JKA frente a Hiroshi Shirai. Su estilo de lucha, dinámico y poderoso, le valió el apodo con el que el mundo lo recuerda: Tora, \"El Tigre\".",
    ],
  },
  {
    id: "inglaterra",
    label: "INGLATERRA, SU SEGUNDO HOGAR",
    title: "LIVERPOOL, 1965.",
    paragraphs: [
      "El 20 de abril de 1965, siguiendo la política de la JKA de enviar instructores al extranjero, Enoeda viajó a Inglaterra junto a los instructores Hiroshi Shirai, Hirokazu Kanazawa y Taiji Kase.",
      "Su destino fue Liverpool: enseñó a tiempo completo en el Red Triangle Dojo y cada mañana a las 7 entrenaba en Sefton Park con un pequeño grupo de alumnos —entre ellos Andy Sherry, Terry O'Neil, Bob Poynton y Bill Christall—, dando el ejemplo de que hasta los campeones de Japón necesitan entrenar todos los días.",
      "En 1969 se casó con Reiko y se estableció en Kingston, Surrey. Como Instructor Jefe de la KUGB (Unión de Karate de Gran Bretaña) formó a generaciones de karatekas, asistido a lo largo de los años por instructores como Sadashige Kato, Shiro Asano, Hideo Tomita, Masao Kawasoe y Yoshinobu Ohta.",
    ],
  },
  {
    id: "tigre",
    label: "EL TIGRE FUERA DEL TATAMI",
    title: "UN MAESTRO DE CULTURA POP.",
    paragraphs: [
      "En 1971 participó en la película de James Bond \"Diamantes para la eternidad\", como uno de los secuaces de Ernst Stavro Blofeld. En 1973 dirigió para la BBC una demostración en vivo de karate que fue la primera transmisión británica dedicada íntegramente a este arte: kihon, kata, combate y demostraciones ante las cámaras.",
      "Escribió varios libros que siguen siendo referencia del Shotokan, entre ellos \"Shotokan: Kata avanzado\" (1983, en tres volúmenes) y la serie \"Karate Shotokan\" (1996). Promocionó su dojo con afiches de \"Dynamic Karate\" en el metro de Londres y enseñó en los baños Marshall Street, cerca de Carnaby Street, hasta sus últimos días.",
    ],
  },
  {
    id: "filosofia",
    label: "SU FILOSOFÍA",
    title: "EL TALENTO SIN PRÁCTICA DIARIA NO SIGNIFICA NADA.",
    paragraphs: [
      "Era conocido por la intensidad de su enseñanza y de su entrenamiento: el talento sin práctica diaria no significa nada.",
      "Cuando le preguntaron si ya se acostumbraba a la comida británica, respondió: \"¡Por supuesto! ¡Ahora me siento británico!\". Vivió como un caballero inglés mientras llevaba el karate Shotokan a los más altos estándares, y amaba profundamente al pueblo que lo recibió.",
    ],
  },
  {
    id: "legado",
    label: "SU LEGADO",
    title: "SU CAMINO SIGUE EN MARCHA.",
    paragraphs: [
      "Enoeda falleció el 29 de marzo de 2003 tras una breve enfermedad. Poco después, la JKA le otorgó póstumamente el rango de 9º dan. Le sobreviven su esposa Reiko y sus hijos Daisuke y Maya.",
      "Su \"camino\" atraviesa a los instructores y a cada generación de karatekas que lo siguieron. ENOEDA Dojo lleva su nombre y entrena en Ecuador con esa misma premisa: técnica, constancia y presencia, todos los días.",
    ],
  },
]

const TIMELINE: Array<[string, string]> = [
  ["1935", "Nace en Kyushu, Japón. A los 16 años, 2º dan de judo."],
  ["c. 1953", "Ingresa a la Universidad de Takushoku; shodan de karate en dos años; capitán del club."],
  ["1957-1960", "Clase de instructores de la JKA, bajo Masatoshi Nakayama."],
  ["1961", "Combate histórico contra Keigo Abe: victoria tras seis prórrogas."],
  ["1963", "Campeón de Japón de la JKA. Apodo: \"El Tigre\"."],
  ["1965", "Llega a Inglaterra: Red Triangle Dojo, Liverpool."],
  ["1969", "Se casa con Reiko; se establecen en Kingston, Surrey."],
  ["1971", "James Bond: \"Diamantes para la eternidad\"."],
  ["1973", "Demostración para la BBC (Open Door): primera TV británica dedicada al karate."],
  ["1983", "\"Shotokan: Kata avanzado\", en tres volúmenes."],
  ["1985", "8º dan."],
  ["2003", "Fallece el 29 de marzo. 9º dan póstumo."],
]

export function MarketingLegado() {
  return (
    <main className={legadoStyles.legadoMain}>
      <section
        aria-labelledby="legado-hero-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
      >
        <div className="mx-auto max-w-360">
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
            <p className={`mt-3 font-marketing-body text-sm font-bold uppercase leading-5 tracking-[0.1em] text-marketing-foreground sm:text-base`}>
              1935 – 2003 · 9º Dan · Campeón de Japón JKA · Instructor Jefe de la KUGB
            </p>
            <p className={`mt-4 ${BODY_TEXT_CLASSES}`}>
              Nuestro dojo lleva su nombre.
            </p>
          </div>
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
            <div className="mt-8 flex max-w-3xl flex-col gap-4">
              {section.paragraphs.map((paragraph) => (
                <p className={BODY_TEXT_CLASSES} key={paragraph.slice(0, 32)}>
                  {paragraph}
                </p>
              ))}
            </div>
          </div>
        </section>
      ))}

      <section
        aria-labelledby="legado-timeline-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="legado-timeline"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>TRAYECTORIA</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="legado-timeline-heading">
            UNA VIDA, DÍA POR DÍA.
          </h2>
          <ol className={styles.pathsIndex}>
            {TIMELINE.map(([year, fact]) => (
              <li className={styles.pathsIndexItem} key={year}>
                <div className={legadoStyles.timelineRow}>
                  <span aria-hidden="true" className={legadoStyles.timelineYear}>
                    {year}
                  </span>
                  <span className={`font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6`}>
                    {fact}
                  </span>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section
        aria-labelledby="legado-cta-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="legado-cta"
      >
        <div className="mx-auto grid max-w-360 gap-8 lg:grid-cols-12 lg:items-end">
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
            <a
              className={`${styles.hardShadow} inline-flex min-h-11 items-center justify-center border-2 border-marketing-surface bg-marketing-accent px-6 py-4 font-marketing-display text-2xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0`}
              href={MARKETING_WHATSAPP_URL}
            >
              ESCRIBIR POR WHATSAPP
            </a>
            <Link
              className="inline-flex min-h-11 items-center justify-center border-2 border-marketing-foreground px-6 py-4 font-marketing-display text-2xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0"
              href="/#sedes"
            >
              CONOCER LAS SEDES
            </Link>
          </div>
        </div>
      </section>
    </main>
  )
}
