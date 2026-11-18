import Image from "next/image"
import Link from "next/link"

import styles from "@/components/marketing/marketing.module.css"
import { MARKETING_WHATSAPP_KARATE_URL } from "@/components/marketing/shared/contact"

import karateStyles from "./karate.module.css"
import {
  KARATE_BAND_IMAGE,
  KARATE_CALLE_IMAGE,
  KARATE_GALLERY,
  KARATE_HERO_IMAGE,
  KARATE_PILLARS,
  KARATE_TRAINING_OPTIONS,
  KARATE_VIDEO,
} from "./karate-content"

// Mosaic placement classes keyed by gallery order: two landscape tiles
// stacked on the left and two portrait tiles spanning both rows on desktop.
const GALLERY_TILE_CLASSES = ["galleryA", "galleryB", "galleryC", "galleryD"] as const

// The third photo (kumite work with gloves) carries the accent hard shadow.
const GALLERY_ACCENT_TILE_INDEX = 2

const HERO_CTA_CLASSES = `${styles.hardShadow} inline-flex min-h-11 items-center border-2 border-marketing-surface bg-marketing-accent px-6 py-4 font-marketing-display text-2xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0`

const SECTION_LABEL_CLASSES =
  "font-marketing-body text-sm font-bold uppercase tracking-[0.18em] text-marketing-accent"

const SECTION_TITLE_CLASSES =
  "font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground"

const BODY_TEXT_CLASSES =
  "font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6"

const INSTITUTIONAL_LINE_CLASSES =
  "font-marketing-body text-sm font-bold uppercase leading-5 tracking-[0.1em] text-marketing-menu-foreground"

export function MarketingKarate() {
  return (
    <main>
      <section
        aria-labelledby="karate-hero-heading"
        className="relative overflow-hidden border-b-2 border-marketing-section-border bg-marketing-surface px-5 pb-16 pt-31 sm:px-8 sm:pb-24 lg:px-16 lg:pb-32 lg:pt-39"
      >
        <div aria-hidden="true" className={karateStyles.heroAmbient} />

        <div className="relative z-10 mx-auto max-w-360">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-end lg:gap-8">
            <div className="lg:col-span-7">
              <p
                className={`mb-6 font-marketing-body text-sm font-bold uppercase tracking-[0.18em] ${styles.heroTriangleLabel}`}
              >
                KARATE-DO // ENOEDA DOJO
              </p>
              <h1
                className="font-marketing-display text-[clamp(4.5rem,12vw,10rem)] leading-[0.78] tracking-[-0.025em] text-marketing-foreground"
                id="karate-hero-heading"
              >
                <span className="block">LINAJE.</span>
                <span className="block pl-[10%] text-marketing-accent">TÉCNICA.</span>
                <span className="block">CARÁCTER.</span>
              </h1>
              <p className="mt-8 max-w-md border-l-2 border-marketing-foreground pl-5 font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6">
                El dojo lleva el nombre de Keinosuke Enoeda, maestro de karate Shotokan formado en
                Japón y recordado por la exigencia de su técnica. Su manera de enseñar es la que se
                practica acá: primero la forma, después la fuerza.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                <a className={HERO_CTA_CLASSES} href={MARKETING_WHATSAPP_KARATE_URL}>
                  QUIERO ENTRENAR
                </a>
                <a className={karateStyles.editorialLink} href="#calle">
                  VER LA DEMOSTRACIÓN
                </a>
              </div>
            </div>

            <figure className={`mt-2 lg:col-span-5 lg:mt-0 ${karateStyles.heroPhoto}`}>
              <div className={karateStyles.heroPhotoFrame}>
                <Image
                  alt={KARATE_HERO_IMAGE.alt}
                  className={karateStyles.heroImage}
                  sizes={KARATE_HERO_IMAGE.sizes}
                  src={KARATE_HERO_IMAGE.image}
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="karate-calle-heading"
        className={`${styles.anchorTarget} border-b-2 border-marketing-section-border bg-marketing-muted px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
        id="calle"
      >
        <div className="mx-auto grid max-w-360 gap-12 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-5">
            <p className={SECTION_LABEL_CLASSES}>DEMOSTRACIÓN // QUITO</p>
            <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="karate-calle-heading">
              EL TATAMI NO ES EL ÚNICO LUGAR DONDE SE PRACTICA.
            </h2>
            <p className={`mt-8 max-w-lg ${BODY_TEXT_CLASSES}`}>
              El dojo sale a la calle con el gi puesto: los alumnos marchan, se forman junto al
              tatami y demuestran kata delante de gente que nunca pisó un dojo. Ahí se entiende
              para qué sirve repetir el mismo movimiento hasta que el cuerpo deja de preguntar.
            </p>
            <p className={`mt-6 max-w-lg ${INSTITUTIONAL_LINE_CLASSES}`}>
              Club formativo especializado de Karate y Kickboxing · Acuerdo Ministerial 143 · Filial
              AFEK 035
            </p>
            <Link className={`mt-8 ${karateStyles.editorialLink}`} href="/legado">
              CONOCER EL LINAJE COMPLETO
            </Link>
          </div>

          <div className={`lg:col-span-7 ${karateStyles.calleMedia}`}>
            <figure>
              <div className={karateStyles.videoFrame}>
                <video
                  aria-label={KARATE_VIDEO.label}
                  className={karateStyles.video}
                  controls
                  playsInline
                  poster={KARATE_VIDEO.poster}
                  preload="metadata"
                >
                  <source src={KARATE_VIDEO.src} type="video/mp4" />
                </video>
              </div>
              <figcaption className={karateStyles.videoCaption}>{KARATE_VIDEO.caption}</figcaption>
            </figure>

            <figure className={karateStyles.callePhoto}>
              <div className={karateStyles.callePhotoFrame}>
                <Image
                  alt={KARATE_CALLE_IMAGE.alt}
                  className={karateStyles.calleImage}
                  sizes={KARATE_CALLE_IMAGE.sizes}
                  src={KARATE_CALLE_IMAGE.image}
                />
              </div>
            </figure>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="karate-alumnos-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="alumnos"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>NUESTROS ALUMNOS</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="karate-alumnos-heading">
            ACÁ EL PROGRESO SE VE DESPACIO.
          </h2>
          <p className={`mt-6 max-w-lg ${BODY_TEXT_CLASSES}`}>
            Un cinturón no se gana en una tarde: se gana repitiendo el mismo kata hasta que sale
            limpio. Estas son las caras de esa espera.
          </p>

          <div className={karateStyles.galleryGrid}>
            {KARATE_GALLERY.map((photo, index) => (
              <figure
                className={`${karateStyles.galleryItem} ${karateStyles[GALLERY_TILE_CLASSES[index]]}`}
                key={photo.alt}
              >
                <div
                  className={
                    index === GALLERY_ACCENT_TILE_INDEX
                      ? `${karateStyles.galleryTile} ${karateStyles.galleryTileAccent}`
                      : karateStyles.galleryTile
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
        aria-labelledby="karate-pilares-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-muted px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="pilares"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>LO QUE SE ENSEÑA</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="karate-pilares-heading">
            TRES PILARES. NADA MÁS.
          </h2>
          <p className={`mt-6 max-w-lg ${BODY_TEXT_CLASSES}`}>
            Todo lo que se trabaja en el tatami cabe en tres ejercicios. Lo demás —grados, torneos,
            medallas— es consecuencia de esos tres.
          </p>

          <div className={karateStyles.pillarsGrid}>
            {KARATE_PILLARS.map((pillar, index) => (
              <article className={karateStyles.pillarCard} key={pillar.name}>
                <span aria-hidden="true" className={karateStyles.pillarIndex}>
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="font-marketing-display text-3xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-4xl">
                  {pillar.name}
                </h3>
                <p className={BODY_TEXT_CLASSES}>{pillar.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section
        aria-labelledby="karate-empezar-heading"
        className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
        id="empezar"
      >
        <div className="mx-auto max-w-360">
          <p className={SECTION_LABEL_CLASSES}>ANTES DE EMPEZAR</p>
          <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="karate-empezar-heading">
            ¿APRENDER O COMPETIR?
          </h2>

          <div className={karateStyles.optionsGrid}>
            {KARATE_TRAINING_OPTIONS.map((option) => (
              <article
                className={`${karateStyles.optionCard} ${option.highlight ? karateStyles.optionCardAccent : ""}`}
                key={option.title}
              >
                {option.badge ? (
                  <span className={karateStyles.optionBadge}>{option.badge}</span>
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

      <section
        aria-labelledby="karate-cierre-heading"
        className={`${karateStyles.bandSection} px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-28`}
      >
        <Image
          alt={KARATE_BAND_IMAGE.alt}
          className="object-cover object-center"
          fill
          sizes={KARATE_BAND_IMAGE.sizes}
          src={KARATE_BAND_IMAGE.image}
        />
        <div aria-hidden="true" className={karateStyles.bandOverlay} />

        <div className={`mx-auto max-w-360 ${karateStyles.bandContent}`}>
          <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
            <div className="lg:col-span-8">
              <p className={SECTION_LABEL_CLASSES}>KARATE-DO // ENOEDA DOJO</p>
              <h2 className={`mt-4 ${SECTION_TITLE_CLASSES}`} id="karate-cierre-heading">
                LA PRIMERA CLASE
                <br />
                ES LA QUE MÁS CUESTA.
              </h2>
            </div>
            <div className="lg:col-span-4 lg:mb-2">
              <p className={`max-w-md ${BODY_TEXT_CLASSES}`}>
                Escríbenos y te decimos día, hora y sede según tu edad y tu nivel. Para empezar
                sólo necesitas ropa cómoda.
              </p>
              <div className="mt-8 flex flex-wrap items-center gap-x-8 gap-y-4">
                <a className={HERO_CTA_CLASSES} href={MARKETING_WHATSAPP_KARATE_URL}>
                  ESCRIBIR POR WHATSAPP
                </a>
                <Link className={karateStyles.editorialLink} href="/#sedes">
                  VER SEDES Y HORARIOS
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  )
}