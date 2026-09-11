import Image from "next/image"

import karateInstructorImage from "@/assets/profesor-karete-1.png"
import senseiPamelaImage from "@/assets/senseiPamela.png"
import styles from "@/components/marketing/marketing.module.css"

const MASTER_CARDS = [
  {
    alt: "Sempai Pamela practicando karate",
    credentials: ["2do Dan en Karate FEK"],
    graphicClassName: styles.masterGraphicPortrait,
    id: "sensei-pamela",
    image: senseiPamelaImage,
    imageClassName: "object-cover object-center scale-105",
    sizes: "(min-width: 1600px) 650px, (min-width: 768px) 44vw, 100vw",
    titleLines: ["Sempai", "Pamela"],
  },
  {
    alt: "Sensei Jonathan practicando karate",
    credentials: [
      "Instructor jefe",
      "3er Dan FEK Shotokan",
      "2do Dan Shorin Ryu EE. UU.",
      "1er Dan cinta negra Kickboxing",
    ],
    graphicClassName: styles.masterGraphic,
    id: "sensei-jonathan-palma",
    image: karateInstructorImage,
    imageClassName: "object-cover object-center scale-105",
    sizes: "(min-width: 1600px) 650px, (min-width: 768px) 44vw, 100vw",
    titleLines: ["Sensei", "Jonathan"],
  },
] as const

export function MarketingMasters() {
  return (
    <section
      aria-labelledby="maestros-heading"
      className={`${styles.anchorTarget} relative border-b-2 border-marketing-section-border px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
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

        <div className="mt-10 flex flex-col lg:mt-14">
          <div className={styles.masterCard}>
            {MASTER_CARDS.map((card) => (
              <article className={styles.masterProfile} key={card.id}>
                <div className={card.graphicClassName}>
                  <Image
                    alt={card.alt}
                    className={card.imageClassName}
                    fill
                    sizes={card.sizes}
                    src={card.image}
                  />
                </div>
                <div className="mt-8 grid gap-5 xl:grid-cols-2 xl:items-start xl:gap-6">
                  <h3 className="max-w-sm font-marketing-display text-5xl leading-[0.82] tracking-[0.01em] text-marketing-foreground sm:text-6xl">
                    {card.titleLines.map((line) => (
                      <span className="block" key={line}>
                        {line}
                      </span>
                    ))}
                  </h3>
                  <ul className="space-y-1.5 font-marketing-body text-sm font-bold uppercase leading-tight tracking-[0.12em] text-marketing-accent xl:pt-1">
                    {card.credentials.map((credential) => (
                      <li key={credential}>{credential}</li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
