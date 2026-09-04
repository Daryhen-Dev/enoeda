import Image from "next/image"
import Link from "next/link"

import studentsImage from "@/assets/estudiantes.png"
import styles from "@/components/marketing/marketing.module.css"

import historyStyles from "./history.module.css"

export function MarketingHistory() {
  return (
    <section
      aria-labelledby="dojo-heading"
      className={`${styles.anchorTarget} ${historyStyles.historySection} border-b-2 border-marketing-section-border px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
      id="dojo"
    >
      <div aria-hidden="true" className={historyStyles.historyAmbient} />
      <div aria-hidden="true" className={historyStyles.historyTatamiPlane} />

      <div className={`${historyStyles.historyGrid} mx-auto max-w-360`}>
        <div className={historyStyles.historyNarrative}>
          <div className={historyStyles.historyContent}>
            <span aria-hidden="true" className={historyStyles.historyAccent} />
            <div className={historyStyles.historyCopy}>
              <h2 className={`${historyStyles.historyTitle} font-marketing-display text-marketing-foreground`} id="dojo-heading">
                EL DOJO,
                <br />
                EN TU CAMINO.
              </h2>
              <div className={historyStyles.historyText}>
                <div className={historyStyles.historyParagraphs}>
                  <p className="font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6">
                    Karate y Kickboxing se encuentran en una práctica que pide técnica, constancia y presencia.
                  </p>
                  <p className="font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6">
                    Cada persona llega con su propio punto de partida. ENOEDA Dojo es un lugar para conocer la práctica, hacer preguntas y elegir la sede más cercana.
                  </p>
                  <Link className={historyStyles.historyEditorialLink} href="/el-camino">
                    CONOCE EL CAMINO DE ENOEDA
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>

        <figure className={historyStyles.historyPhoto}>
          <div className={historyStyles.historyPhotoFrame}>
            <Image
              alt="Estudiantes entrenando juntos en ENOEDA Dojo"
              className={historyStyles.historyImage}
              sizes="(min-width: 480px) 42vw, (min-width: 360px) and (min-aspect-ratio: 3 / 2) 42vw, 100vw"
              src={studentsImage}
            />
          </div>
        </figure>
      </div>
    </section>
  )
}
