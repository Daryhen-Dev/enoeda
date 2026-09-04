import styles from "@/components/marketing/marketing.module.css"

const JOURNEY_STEPS = [
  "CONOCÉ EL DOJO Y LA PRÁCTICA.",
  "ESCRIBÍ POR WHATSAPP.",
  "ELEGÍ UNA SEDE.",
] as const

export function MarketingJourney() {
  return (
    <section
      aria-labelledby="camino-heading"
      className="border-b-2 border-marketing-section-border bg-marketing-surface px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32"
    >
      <div className="mx-auto max-w-360">
        <div className="grid gap-8 lg:grid-cols-12 lg:items-end">
          <h2
            className="font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground lg:col-span-8"
            id="camino-heading"
          >
            UN CAMINO,
            <br />
            TRES PASOS.
          </h2>
          <p className="max-w-md font-marketing-body text-base leading-6 text-marketing-foreground lg:col-span-4 lg:mb-1">
            Para personas adultas y niños: un punto de partida claro para conocer el dojo.
          </p>
        </div>

        <ol className={styles.journeyList}>
          {JOURNEY_STEPS.map((step, index) => (
            <li className={styles.journeyStep} key={step}>
              <span aria-hidden="true" className={styles.journeyIndex}>
                {String(index + 1).padStart(2, "0")}
              </span>
              <h3 className="font-marketing-display text-4xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-5xl">
                {step}
              </h3>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
