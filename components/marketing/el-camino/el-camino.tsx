import Image from "next/image"
import Link from "next/link"

import enoedaLogoImage from "@/assets/enoeda-logo.webp"

import styles from "@/components/marketing/el-camino/el-camino.module.css"

export function MarketingElCamino() {
  return (
    <main className={styles.elCaminoMain}>
      <article className={styles.elCaminoArticle}>
        <header className={styles.elCaminoHeader}>
          <Image
            alt=""
            aria-hidden="true"
            className={styles.elCaminoSeal}
            height={600}
            priority
            src={enoedaLogoImage}
            width={600}
          />
          <h1 className={styles.elCaminoTitle}>
            MÁS QUE UN DOJO,
            <br />
            UNA FAMILIA QUE CRECE CONTIGO.
          </h1>
          <p className={styles.elCaminoIntro}>
            Entrar a nuestro dojo es dar el primer paso hacia una transformación
            que va más allá del aprendizaje de Karate y Kickboxing: disciplina,
            respeto, perseverancia y superación personal. Cada entrenamiento es
            una oportunidad para descubrir de lo que eres capaz.
          </p>
        </header>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            EL CAMINO DEL KARATE.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              En Karate, todo comienza con el cinturón blanco: el símbolo de
              una mente abierta, preparada para aprender. Desde las primeras
              posiciones, defensas, golpes y desplazamientos, el estudiante
              empieza a desarrollar coordinación, equilibrio, concentración y
              control corporal.
            </p>
            <p>
              Cada nuevo cinturón será mucho más que un cambio de color:
              representará los obstáculos superados, las horas de entrenamiento
              y la decisión de no rendirse. Y el cinturón negro no es el final,
              sino estar preparado para comenzar una nueva etapa con mayor
              conocimiento, responsabilidad y humildad.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            TÉCNICA Y CALMA EN KICKBOXING.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              En Kickboxing, el estudiante aprenderá a combinar técnica,
              velocidad, precisión, resistencia y estrategia. Cada golpe, cada
              defensa y cada movimiento se trabajan de manera progresiva y
              segura, y el entrenamiento fortalece la confianza y la capacidad
              de mantener la calma aun en los momentos de mayor exigencia.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>NADIE CAMINA SOLO.</h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              En ambas disciplinas, nadie recorre el camino completamente solo.
              Durante los entrenamientos, los estudiantes conocen compañeros con
              quienes comparten el cansancio, los nervios de cada examen y la
              alegría de avanzar; con el tiempo, esos compañeros se convierten
              en amigos y verdaderos hermanos de camino.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            EL VALOR DE COMENZAR.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              Aquí no importa si al principio sientes miedo, inseguridad o
              piensas que no tienes suficiente fuerza. La fuerza se construye.
              La confianza se entrena. La disciplina se aprende. Lo
              verdaderamente importante es tener el valor de comenzar y la
              voluntad de continuar.
            </p>
          </div>
        </section>

        <div className={styles.elCaminoExit}>
          <p className={styles.elCaminoExitLine}>
            Tu camino comienza con un cinturón blanco, pero no tiene límites.
          </p>
          <Link className={styles.elCaminoExitLink} href="/#sedes">
            CONOCE NUESTRAS SEDES
          </Link>
        </div>
      </article>
    </main>
  )
}
