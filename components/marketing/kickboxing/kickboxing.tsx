import Image from "next/image"

import styles from "@/components/marketing/marketing.module.css"
import { getMarketingWhatsAppUrl } from "@/components/marketing/shared/contact"

import kickboxingStyles from "./kickboxing.module.css"
import {
  KICKBOXING_GALLERY,
  KICKBOXING_HERO_IMAGE,
  KICKBOXING_STYLES,
  KICKBOXING_TRAINING_OPTIONS,
  KICKBOXING_WHATSAPP_MESSAGE,
} from "./kickboxing-content"

const KICKBOXING_WHATSAPP_URL = getMarketingWhatsAppUrl(KICKBOXING_WHATSAPP_MESSAGE)

// Mosaic placement classes keyed by gallery order: two landscape tiles
// stacked on the left and two portrait tiles spanning both rows on desktop.
const GALLERY_TILE_CLASSES = ["galleryA", "galleryB", "galleryC", "galleryD"] as const

// The third photo (a group class in guard) carries the accent hard shadow.
const GALLERY_ACCENT_TILE_INDEX = 2

const HERO_CTA_CLASSES = `${styles.hardShadow} inline-flex min-h-11 items-center border-2 border-marketing-surface bg-marketing-accent px-6 py-4 font-marketing-display text-2xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0`

const SECTION_LABEL_CLASSES =
  "font-marketing-body text-sm font-bold uppercase tracking-[0.18em] text-marketing-accent"

const SECTION_TITLE_CLASSES =
  "font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground"

const BODY_TEXT_CLASSES =
  "font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6"

export function MarketingKickboxing() {
  return (
    <main>
      <section
        aria-labelledby="kickboxing-hero-heading"
        className="relative overflow-hidden border-b-2 border-marketing-section-border bg-marketing-surface px-5 pb-16 pt-31 sm:px-8 sm:pb-24 lg:px-16 lg:pb-32 lg:pt-39"
      >
        <div aria-hidden="true" className={kickboxingStyles.heroAmbient} />

        <div className="relative z-10 mx-auto max-w-360">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-end lg:gap-8">
            <div className="lg:col-span-7">
              <p
                className={`mb-6 font-marketing-body text-sm font-bold uppercase tracking-[0.18em] ${styles.heroTriangleLabel}`}
              >
                KICKBOXING // ENOEDA DOJO
              </p>
              <h1
                className="font-marketing-display text-[clamp(4.5rem,12vw,10rem)] leading-[0.78] tracking-[-0.025em] text-marketing-foreground"
                id="kickboxing-hero-heading"
              >
                <span className="block">PUÑOS.</span>
                <span className="block pl-[10%] text-marketing-accent">PIERNAS.</span>
                <span className="block">INSTINTO.</span>
              </h1>
              <p className="mt-8 max-w-md border-l-2 border-marketing-foreground pl-5 font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6">
                Antes de tener nombre, ya existía. Durante siglos, distintas culturas buscaron la
                forma perfecta de unir el golpe de la mano con la fuerza de la pierna. Un día, en
                Japón, alguien le puso nombre. Esta es esa historia, y la tuya puede empezar aquí.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                <a className={HERO_CTA_CLASSES} href={KICKBOXING_WHATSAPP_URL}>
                  QUIERO ENTRENAR
                </a>
                <a className={kickboxingStyles.editorialLink} href="#historia">
                  VER LA HISTORIA
                </a>
              </div>
            </div>

            <figure className={`mt-2 lg:col-span-5 lg:mt-0 ${kickboxingStyles.heroPhoto}`}>
              <div className={kickboxingStyles.heroPhotoFrame}>
                <Image
                  alt={KICKBOXING_HERO_IMAGE.alt}
                  className={kickboxingStyles.heroImage}
                  sizes={KICKBOXING_HERO_IMAGE.sizes}
                  src={KICKBOXING_HERO_IMAGE.image}
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="kickboxing-historia-heading"
        className={`${styles.anchorTarget} border-b-2 border-marketing-section-border bg-marketing-muted px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
        id="historia"
      >
        <div className="mx-auto grid max-w-360 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className={SECTION_LABEL_CLASSES}>HISTORIA // CARAPUNGO</p>
            <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="kickboxing-historia-heading">
              LA HISTORIA TAMBIÉN SE ESCRIBE EN LA CALLE.
            </h2>
            <p className={`mt-8 max-w-lg ${BODY_TEXT_CLASSES}`}>
              Sin ring, sin luces, sin público. Solo guardia arriba, pies en movimiento y un grupo
              que decidió no quedarse quieto. Así entrenan nuestros alumnos: con la misma esencia
              que hace sesenta años llenó estadios en Japón.
            </p>
          </div>

          <figure className="lg:col-span-5">
            <div className={kickboxingStyles.videoFrame}>
              <video
                aria-label="Video del entrenamiento de kickboxing de ENOEDA Dojo en Carapungo"
                className={kickboxingStyles.video}
                controls
                playsInline
                poster="/media/kickboxing/entrenamiento.webp"
                preload="metadata"
              >
                <source src="/media/kickboxing/entrenamiento.mp4" type="video/mp4" />
              </video>
            </div>
            <figcaption className={kickboxingStyles.videoCaption}>
              Entrenamiento de kickboxing ENOEDA en Carapungo
            </figcaption>
          </figure>
        </div>
      </section>

      <section
        aria-labelledby="kickboxing-alumnos-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="alumnos"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>NUESTROS ALUMNOS</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="kickboxing-alumnos-heading">
            AQUÍ NO SE MIRA. SE ENTRENA.
          </h2>
          <p className={`mt-6 max-w-lg ${BODY_TEXT_CLASSES}`}>
            Cada foto es una guardia que se sostuvo un poco más, una combinación que por fin salió
            limpia.
          </p>

          <div className={kickboxingStyles.galleryGrid}>
            {KICKBOXING_GALLERY.map((photo, index) => (
              <figure
                className={`${kickboxingStyles.galleryItem} ${kickboxingStyles[GALLERY_TILE_CLASSES[index]]}`}
                key={photo.alt}
              >
                <div
                  className={
                    index === GALLERY_ACCENT_TILE_INDEX
                      ? `${kickboxingStyles.galleryTile} ${kickboxingStyles.galleryTileAccent}`
                      : kickboxingStyles.galleryTile
                  }
                >
                  <Image
                    alt={photo.alt}
                    className="object-cover object-center"
                    fill
                    sizes={photo.sizes}
                    src={photo.image}
                  />
                </div>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="kickboxing-estilos-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-muted px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="estilos"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>UN NOMBRE, SEIS LENGUAJES</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="kickboxing-estilos-heading">
            NO TODO KICKBOXING SE PELEA IGUAL.
          </h2>
          <p className={`mt-6 max-w-lg ${BODY_TEXT_CLASSES}`}>
            En Japón es una fusión, en Estados Unidos fue karate con contacto, en Holanda es
            presión pura. Conocer las diferencias es entender por qué cada peleador se mueve como
            se mueve.
          </p>

          <div className={kickboxingStyles.stylesGrid}>
            {KICKBOXING_STYLES.map((style, index) => (
              <article className={kickboxingStyles.styleCard} key={style.name}>
                <span aria-hidden="true" className={kickboxingStyles.styleIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-marketing-display text-3xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-4xl">
                  {style.name}
                </h3>
                <p className={BODY_TEXT_CLASSES}>{style.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="kickboxing-entrenamiento-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>ANTES DE EMPEZAR</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="kickboxing-entrenamiento-heading">
            ¿SUDAR O APRENDER A PELEAR?
          </h2>

          <div className={kickboxingStyles.optionsGrid}>
            {KICKBOXING_TRAINING_OPTIONS.map((option) => (
              <article
                className={`${kickboxingStyles.optionCard} ${option.highlight ? kickboxingStyles.optionCardAccent : ""}`}
                key={option.title}
              >
                {option.badge ? (
                  <span className={kickboxingStyles.optionBadge}>{option.badge}</span>
                ) : null}
                <h3 className="font-marketing-display text-4xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-5xl">
                  {option.title}
                </h3>
                <p className={BODY_TEXT_CLASSES}>{option.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
    </main>
  )
}
