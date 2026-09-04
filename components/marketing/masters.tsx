import Image from "next/image"

import karateInstructorImage from "@/assets/profesor-karete-1.png"
import karateInstructorsImage from "@/assets/profesores-karate.png"
import styles from "@/components/marketing/marketing.module.css"

const MASTER_CARDS = [
  {
    alt: "Sensei Jonathan Palma practicando karate",
    description: undefined,
    id: "sensei-jonathan-palma",
    image: karateInstructorImage,
    imageClassName: "object-cover object-center",
    titleLines: ["Sensei", "Jonathan Palma"],
  },
  {
    alt: "Grupo de instructores de karate",
    description: "Técnica. Disciplina. Movimiento.",
    id: "karate-instructors",
    image: karateInstructorsImage,
    imageClassName: "object-cover object-top",
    titleLines: ["Instructores"],
  },
] as const

export function MarketingMasters() {
  return (
    <section
      aria-labelledby="maestros-heading"
      className={`${styles.anchorTarget} relative px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
      id="maestros"
    >
      <div className="mx-auto max-w-360">
        <div className="grid gap-8 border-b-2 border-marketing-foreground pb-10 lg:grid-cols-12 lg:items-end">
          <p className="font-marketing-body text-sm font-bold uppercase tracking-[0.18em] text-marketing-accent lg:col-span-3">
            Maestros
          </p>
          <h2
            className="font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground lg:col-span-8"
            id="maestros-heading"
          >
            APRENDER DESDE LA PRÁCTICA.
          </h2>
        </div>

        <div className="mt-10 grid gap-8 md:grid-cols-2 lg:mt-14 lg:gap-12">
          {MASTER_CARDS.map((card) => (
            <article className={styles.masterCard} key={card.id}>
              <div className={styles.masterGraphic}>
                <Image
                  alt={card.alt}
                  className={card.imageClassName}
                  fill
                  sizes="(min-width: 768px) 50vw, 100vw"
                  src={card.image}
                />
              </div>
              <h3 className="mt-8 max-w-sm font-marketing-display text-5xl leading-[0.82] tracking-[0.01em] text-marketing-foreground sm:text-6xl">
                {card.titleLines.map((line) => (
                  <span className="block" key={line}>
                    {line}
                  </span>
                ))}
              </h3>
              {card.description ? (
                <p className="mt-4 max-w-sm font-marketing-body text-base leading-relaxed text-marketing-foreground">
                  {card.description}
                </p>
              ) : null}
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
