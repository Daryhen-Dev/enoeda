import { getMarketingWhatsAppUrl } from "@/components/marketing/contact"
import styles from "@/components/marketing/marketing.module.css"

const LOCATIONS = [
  {
    address:
      "Avenida Padre Luis Bacari y Río Bermejo, Centro Comercial Bacari Plaza, segundo piso, local de Karate.",
    name: "Carapungo",
  },
  {
    address:
      "Avenida Fenicio Angulo y Mercedes Obando, casa de tres pisos con vidrios azules, primer piso.",
    name: "San José de Morán",
  },
  {
    address:
      "Avenida Misael Acosta y Jesús del Gran Poder, al lado de lavadora de autos, casa de un piso color blanco.",
    name: "San Juan de Calderón",
  },
] as const

export function MarketingLocations() {
  return (
    <section
      aria-labelledby="sedes-heading"
      className={`${styles.anchorTarget} ${styles.locationsSection} border-b-2 border-marketing-section-border px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
      id="sedes"
    >
      <div className="mx-auto max-w-360">
        <h2
          className="max-w-3xl font-marketing-display text-[clamp(3.5rem,7vw,6.5rem)] leading-[0.85] tracking-[-0.02em] text-marketing-foreground"
          id="sedes-heading"
        >
          ENCONTRÁ TU SEDE.
        </h2>
        <p className="mt-5 max-w-md font-marketing-body text-base leading-6 text-marketing-foreground">
          Tres sedes para acercarte al dojo.
        </p>

        <div className={styles.locationsList}>
          {LOCATIONS.map((location) => (
            <article className={styles.locationItem} key={location.name}>
              <h3 className="font-marketing-display text-4xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-5xl">
                {location.name}
              </h3>
              <p className="font-marketing-body text-base leading-6 text-marketing-foreground">
                {location.address}
              </p>
              <a
                aria-label={`Escribir por WhatsApp sobre la sede de ${location.name}`}
                className={`${styles.hardShadow} inline-flex min-h-11 items-center justify-center self-start border-2 border-marketing-surface bg-marketing-accent px-5 py-3 font-marketing-display text-xl tracking-[0.04em] text-marketing-foreground transition-transform hover:-translate-x-1 hover:-translate-y-1 focus-visible:outline-2 focus-visible:outline-offset-6 focus-visible:outline-marketing-foreground motion-reduce:transition-none motion-reduce:hover:translate-x-0 motion-reduce:hover:translate-y-0`}
                href={getMarketingWhatsAppUrl(
                  `Hola, quiero consultar por la sede de ${location.name}.`
                )}
              >
                ESCRIBIR POR WHATSAPP
              </a>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
