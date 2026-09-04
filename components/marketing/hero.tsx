import Image from "next/image"

import heroImage from "@/assets/enoeda-hero.png"
import styles from "@/components/marketing/marketing.module.css"

export function MarketingHero() {
  return (
    <section
      aria-labelledby="hero-heading"
      className="relative overflow-hidden border-b-2 border-marketing-section-border bg-marketing-surface px-5 pb-16 pt-31 sm:px-8 sm:pb-24 lg:px-16 lg:pb-32 lg:pt-39"
    >
      <Image
        alt=""
        aria-hidden="true"
        className="object-cover object-center"
        fill
        priority
        sizes="100vw"
        src={heroImage}
      />
      <div aria-hidden="true" className={`pointer-events-none absolute inset-0 ${styles.heroImageOverlay}`} />

      <div className="relative z-10 mx-auto grid max-w-360 grid-cols-1 gap-10 lg:grid-cols-12 lg:items-end lg:gap-8">
        <div className="relative lg:col-span-8">
          <p className="mb-6 font-marketing-body text-sm font-bold uppercase tracking-[0.18em] text-marketing-accent">
            Práctica marcial // enfoque presente
          </p>
          <h1
            className="font-marketing-display text-[clamp(4.75rem,12vw,10.5rem)] leading-[0.76] tracking-[-0.025em] text-marketing-foreground"
            id="hero-heading"
          >
            <span className="block">DISCIPLINA.</span>
            <span className="block pl-[10%] text-marketing-accent">PODER.</span>
            <span className="block">FUERZA.</span>
          </h1>
        </div>

        <div className="relative border-l-2 border-marketing-foreground pl-5 lg:col-span-4 lg:mb-4 lg:pl-8">
          <p className="max-w-72 font-marketing-body text-lg leading-7 text-marketing-foreground">
            Un lugar para poner el cuerpo en práctica y avanzar con intención.
          </p>
          <a
            className={`${styles.hardShadow} mt-8 inline-flex border-2 border-marketing-surface bg-marketing-accent px-6 py-4 font-marketing-display text-2xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground`}
            href="#historia"
          >
            EXPLORAR EL DOJO
          </a>
        </div>
      </div>
    </section>
  )
}
