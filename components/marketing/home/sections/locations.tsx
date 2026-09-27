import styles from "@/components/marketing/marketing.module.css"

const LOCATIONS = [
  {
    address:
      "Avenida Padre Luis Bacari y Río Bermejo, Centro Comercial Bacari Plaza, segundo piso, local de Karate.",
    mapUrl: "https://maps.app.goo.gl/5eWgbJHhvtQHPTUZ7",
    name: "Carapungo",
    schedule: [
      {
        label: "Lunes, miércoles y viernes",
        entries: ["07:00–08:00", "08:00–09:00", "09:00–10:00"],
      },
      {
        label: "Martes y jueves",
        entries: ["18:00–19:00", "19:00–20:00", "20:00–21:00"],
      },
      {
        label: "Sábados",
        entries: ["08:00–09:30 · Colectivo"],
      },
    ],
    slug: "carapungo",
  },
  {
    address:
      "Avenida Fenicio Angulo y Mercedes Obando, casa de tres pisos con vidrios azules, primer piso.",
    mapUrl: "https://maps.app.goo.gl/hqXr82rbCzLgzw3Y6",
    name: "San José de Morán",
    schedule: [
      {
        label: "Martes, jueves y viernes",
        entries: [
          "16:00–17:00 · Preescolar (4–6 años)",
          "17:00–18:00 · 7–11 años",
          "18:00–19:30 · Juvenil y adultos",
          "08:00–09:00 · Niños, jóvenes y adultos",
        ],
      },
    ],
    slug: "san-jose-de-moran",
  },
  {
    address:
      "Avenida Misael Acosta y Jesús del Gran Poder, al lado de lavadora de autos, casa de un piso color blanco.",
    mapUrl: "https://maps.app.goo.gl/zsRj3MVgVECgW1GP8",
    name: "San Juan de Calderón",
    schedule: [
      {
        label: "Martes, jueves y viernes",
        entries: [
          "15:00–16:00 · 4–6 años",
          "16:00–17:00 · 7–15 años",
          "17:00–18:00 · Juvenil y adultos",
          "08:00–09:00 · Niños, jóvenes y adultos",
        ],
      },
    ],
    slug: "san-juan-de-calderon",
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
          ENCUENTRA TU SEDE.
        </h2>
        <p className="mt-5 max-w-md font-marketing-body text-base leading-6 text-marketing-foreground">
          Tres sedes para acercarte al dojo.
        </p>

        <div className={styles.locationsList}>
          {LOCATIONS.map((location) => {
            const scheduleHeadingId = `${location.slug}-schedule-heading`

            return (
              <article className={styles.locationItem} key={location.name}>
                <header className={styles.locationTitle}>
                  <h3 className="font-marketing-display text-4xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-5xl">
                    {location.name}
                  </h3>
                </header>
                <div
                  className={`${styles.locationBody} ${styles.locationBodyWithSchedule}`}
                >
                  <div className={styles.locationDetails}>
                    <p
                      className={`${styles.locationAddress} font-marketing-body text-base leading-6 text-marketing-foreground`}
                    >
                      {location.address}
                    </p>
                    <a
                      aria-label={`Abrir ubicación de ${location.name} en Google Maps`}
                      className="inline-flex min-h-11 w-fit items-center font-marketing-body text-sm font-bold uppercase tracking-[0.14em] text-marketing-foreground underline decoration-2 underline-offset-4 transition-colors hover:text-marketing-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-marketing-foreground motion-reduce:transition-none"
                      href={location.mapUrl}
                      rel="noreferrer"
                      target="_blank"
                    >
                      ABRIR EN GOOGLE MAPS
                    </a>
                  </div>
                  <section
                    aria-labelledby={scheduleHeadingId}
                    className={styles.locationSchedule}
                  >
                    <h4
                      className="font-marketing-display text-2xl leading-none tracking-[0.04em] text-marketing-foreground"
                      id={scheduleHeadingId}
                    >
                      HORARIOS DE {location.name.toUpperCase()}
                    </h4>
                    <dl className={styles.locationScheduleGroups}>
                      {location.schedule.map((schedule) => (
                        <div
                          className={styles.locationScheduleGroup}
                          key={schedule.label}
                        >
                          <dt className="font-marketing-body text-sm font-bold uppercase tracking-[0.08em] text-marketing-foreground">
                            {schedule.label}
                          </dt>
                          <dd>
                            <ul className={styles.locationScheduleEntries}>
                              {schedule.entries.map((entry) => (
                                <li
                                  className={`${styles.locationScheduleEntry} font-marketing-body text-base leading-6 text-marketing-foreground`}
                                  key={entry}
                                >
                                  {entry}
                                </li>
                              ))}
                            </ul>
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                </div>
              </article>
            )
          })}
        </div>
      </div>
    </section>
  )
}
