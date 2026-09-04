import Link from "next/link"

import styles from "@/components/marketing/el-camino/el-camino.module.css"

export function MarketingElCamino() {
  return (
    <main className={styles.elCaminoMain}>
      <article className={styles.elCaminoArticle}>
        <header className={styles.elCaminoHeader}>
          <h1 className={styles.elCaminoTitle}>
            MÁS QUE UN DOJO,
            <br />
            UNA FAMILIA QUE CRECE CONTIGO.
          </h1>
          <p className={styles.elCaminoIntro}>
            Entrar a nuestro dojo es dar el primer paso hacia una transformación
            que va mucho más allá del aprendizaje de Karate y Kickboxing. Es
            comenzar un camino de disciplina, respeto, perseverancia y
            superación personal, donde cada entrenamiento representa una
            oportunidad para descubrir de lo que eres capaz.
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
              Con práctica y constancia, aprenderá técnicas cada vez más
              completas, perfeccionará sus katas, comprenderá su aplicación y
              fortalecerá tanto su cuerpo como su carácter.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            CADA CINTURÓN CUENTA UNA HISTORIA.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              Cada nuevo cinturón será mucho más que un cambio de color.
              Representará los obstáculos superados, las horas de entrenamiento,
              los errores convertidos en experiencia y la decisión de no
              rendirse cuando el camino se vuelva difícil.
            </p>
            <p>
              Del blanco al amarillo, del naranja al verde, del azul al marrón,
              hasta alcanzar el tan admirado cinturón negro, cada etapa contará
              una historia de esfuerzo, crecimiento y determinación.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            EL CINTURÓN NEGRO ES UN NUEVO COMIENZO.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              Alcanzar el cinturón negro no significa llegar al final. Significa
              estar preparado para comenzar una nueva etapa con mayor
              conocimiento, responsabilidad y humildad.
            </p>
            <p>
              Un verdadero karateca no se define solamente por las técnicas que
              domina, sino por su capacidad para respetar, ayudar, perseverar y
              levantarse después de cada caída.
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
              defensa y cada movimiento serán trabajados de manera progresiva y
              segura.
            </p>
            <p>
              El entrenamiento ayudará a mejorar la condición física, liberar
              tensiones, fortalecer la confianza y desarrollar la capacidad de
              mantener la calma aun en los momentos de mayor exigencia.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            CRECER JUNTO A LA COMUNIDAD.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              En ambas disciplinas, nadie recorre el camino completamente solo.
              Durante los entrenamientos, los estudiantes conocerán compañeros
              con quienes compartirán el cansancio, los nervios de cada examen,
              la emoción de avanzar y la alegría de alcanzar nuevas metas.
            </p>
            <p>
              Con el tiempo, esos compañeros dejarán de ser solamente personas
              con quienes entrenar: se convertirán en amigos, aliados y, muchas
              veces, en verdaderos hermanos de camino.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            EL DOJO NOS UNE.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              Dentro del dojo se construye un vínculo especial. Aprendemos a
              cuidarnos, a respetarnos y a impulsarnos mutuamente. Celebramos
              el progreso de los demás como si fuera propio, porque entendemos
              que detrás de cada logro existe una historia de esfuerzo que
              merece ser reconocida.
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
            <p>
              Cada caída te enseñará a levantarte. Cada dificultad te hará más
              fuerte. Cada cinturón te recordará cuánto avanzaste. Y cada
              compañero que camine a tu lado hará que el recorrido tenga un
              significado todavía más profundo.
            </p>
          </div>
        </section>

        <section className={styles.elCaminoSection}>
          <h2 className={styles.elCaminoSectionTitle}>
            UN CAMINO SIN LÍMITES.
          </h2>
          <div className={styles.elCaminoSectionBody}>
            <p>
              Ven a descubrir tu fuerza, supera tus propios límites y
              conviértete en la mejor versión de ti. Tu camino comienza con un
              cinturón blanco, pero no tiene límites.
            </p>
          </div>
        </section>

        <div className={styles.elCaminoExit}>
          <Link className={styles.elCaminoExitLink} href="/#sedes">
            CONOCE NUESTRAS SEDES
          </Link>
        </div>
      </article>
    </main>
  )
}
