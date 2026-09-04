import styles from "@/components/marketing/marketing.module.css"

const LOCATIONS = [
  {
    address:
      "Avenida Padre Luis Bacari y Río Bermejo, Centro Comercial Bacari Plaza, segundo piso, local de Karate.",
    name: "Carapungo",
    schedule: [
      {
        discipline: "Karate",
        entries: [
          "Lunes, martes y miércoles · 08:00–09:00",
          "Lunes, miércoles y viernes · 17:00–18:00",
          "Sábado · 09:00",
        ],
      },
      {
        discipline: "Kickboxing",
        entries: [
          "Lunes, martes y miércoles · 07:00–08:00",
          "Martes y jueves · 18:00–19:00",
          "Martes y jueves · 19:00–20:00",
          "Sábado · 07:50–09:00",
        ],
      },
    ],
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
              <header className={styles.locationTitle}>
                <h3 className="font-marketing-display text-4xl leading-[0.85] tracking-[0.01em] text-marketing-foreground sm:text-5xl">
                  {location.name}
                </h3>
              </header>
              <div
                className={
                  "schedule" in location
                    ? `${styles.locationBody} ${styles.locationBodyWithSchedule}`
                    : styles.locationBody
                }
              >
                <p
                  className={`${styles.locationAddress} font-marketing-body text-base leading-6 text-marketing-foreground`}
                >
                  {location.address}
                </p>
                {"schedule" in location ? (
                  <section
                    aria-labelledby="carapungo-schedule-heading"
                    className={styles.locationSchedule}
                  >
                    <h4
                      className="font-marketing-display text-2xl leading-none tracking-[0.04em] text-marketing-foreground"
                      id="carapungo-schedule-heading"
                    >
                      HORARIOS DE CARAPUNGO
                    </h4>
                    <dl className={styles.locationScheduleGroups}>
                      {location.schedule.map((schedule) => (
                        <div
                          className={styles.locationScheduleGroup}
                          key={schedule.discipline}
                        >
                          <dt className="font-marketing-body text-sm font-bold uppercase tracking-[0.08em] text-marketing-foreground">
                            {schedule.discipline}
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
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
