import Image from "next/image"

import studentsImage from "@/assets/estudiantes.png"
import styles from "@/components/marketing/marketing.module.css"

export function MarketingHistory() {
  return (
    <section
      aria-labelledby="historia-heading"
      className={`${styles.anchorTarget} ${styles.historySection} border-b-2 border-marketing-section-border px-5 py-18 sm:px-8 sm:py-24 lg:px-16 lg:py-32`}
      id="historia"
    >
      <div className={`${styles.historyGrid} mx-auto grid max-w-360 grid-cols-1 gap-12 min-[1024px]:grid-cols-12 min-[1024px]:gap-8`}>
        <div className="min-[1024px]:col-span-5">
          <div className={styles.historyContent}>
            <span aria-hidden="true" className={styles.historyAccent} />
            <div className={styles.historyCopy}>
              <h2 className={`${styles.historyTitle} font-marketing-display text-marketing-foreground`} id="historia-heading">
                NUESTRA
                <br />
                HISTORIA
              </h2>
              <div className={styles.historyText}>
                <div className={styles.historyParagraphs}>
                  <p className="font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6">
                    Forjados en la tradición, perfeccionados por la modernidad. Enoeda Dojo representa la síntesis absoluta entre la disciplina milenaria del Karate y la ferocidad táctica del Kickboxing.
                  </p>
                  <p className="font-marketing-body text-sm leading-5 text-marketing-foreground sm:text-base sm:leading-6">
                    Desde 1988, no creamos estudiantes; forjamos guerreros. Nuestro enfoque no es solo perfeccionar una técnica, la potencia y el control mental absoluto.
                  </p>
                </div>
              </div>
              <p className={`${styles.historyManifest} font-marketing-body text-sm font-bold uppercase tracking-[0.16em] text-marketing-foreground`}>
                LEER MANIFIESTO <span aria-hidden="true" className="text-marketing-accent">→</span>
              </p>
            </div>
          </div>
        </div>

        <figure className={`${styles.historyPhoto} min-[1024px]:col-span-7`}>
          <div className={styles.historyPhotoFrame}>
            <Image
              alt="Estudiantes entrenando juntos en ENOEDA Dojo"
              className={styles.historyImage}
              sizes="(min-width: 1024px) 52vw, 100vw"
              src={studentsImage}
            />
          </div>
        </figure>
      </div>
    </section>
  )
}
