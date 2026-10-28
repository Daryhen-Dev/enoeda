# Feature: legado-page (paso 2 del roadmap)

## Goal

Página pública dedicada al Sensei Keinosuke Enoeda: biografía, trayectoria, filosofía y legado
histórico. Contenido redactado y consolidado desde tres fuentes provistas por el usuario; pendiente
de su validación antes de publicar.

## Contenido validado pendiente (borrador completo al final del Log)

## Specs (propuesta de estructura para la página)

S1 — Ruta `/legado` con metadata propia ("El legado de Enoeda | ENOEDA Dojo").
S2 — Hero: "EL TIGRE." + Keinosuke Enoeda (1935–2003), 9º dan, campeón de Japón JKA, instructor
jefe de la KUGB. "Nuestro dojo lleva su nombre."
S3 — Secciones narrativas: Los primeros años · La escuela de la JKA · Inglaterra, su segundo hogar ·
El Tigre fuera del tatami · Su filosofía · Su legado.
S4 — Línea de tiempo de datos clave (1935 → 2003).
S5 — CTA final hacia inscripciones (WhatsApp / sedes).
S6 — El directorio de la home (`paths.tsx`) apunta "Legado del Sensei Keinosuke Enoeda" a `/legado`
(hoy `/#dojo`); agregar la entrada al nav público si corresponde.

## Tasks

- [x] T1 — Contenido validado por el usuario (este documento, Log L2)
- [x] T2 — Ruta + componente `components/marketing/legado/legado.tsx` con el contenido de L2
- [x] T3 — Actualizar href del directorio de la home y nav
- [x] T4 — Tests (títulos, secciones, CTA), build, capturas, PR

## Log

L1 (user, verbatim): petición de crear la página del legado + tres fuentes (biografía estilo
Wikipedia en español; perfil de la KUGB en inglés; resumen "El Tigre").

L2 (BORRADOR DE CONTENIDO — consolidado en español, a validar):

### HERO
EL TIGRE.
Keinosuke Enoeda (1935 – 2003)
9º Dan · Campeón de Japón JKA · Instructor Jefe de la KUGB
Nuestro dojo lleva su nombre.

### LOS PRIMEROS AÑOS
Keinosuke Enoeda nació el 4 de julio de 1935 en Kyushu, al sur de Japón. De joven practicó los
deportes populares de su país: béisbol, kendo y judo. En judo destacó de manera especial: a los
16 años ya era 2º dan.
El destino lo llevó a una demostración de karate en la Universidad de Takushoku: quedó tan
impresionado que canalizó toda su energía en este arte. Se inscribió en la universidad, se unió a
la sección de karate y en dos años obtuvo su shodan (1º dan); dos años más tarde era el capitán
del club. Se graduó en economía.

### LA ESCUELA DE LA JKA
Tras graduarse, ingresó a la clase de instructores de la Asociación Japonesa de Karate (JKA),
donde entrenó durante tres años bajo la dirección principal de Masatoshi Nakayama, instructor
jefe de la JKA. Uno de sus maestros fue Gichin Funakoshi, fundador del karate Shotokan, cuya
enseñanza fue una gran inspiración para él. También entrenó kumite bajo la dirección de Taiji
Kase, junto a otros grandes instructores de la época.
Esa calidad de instrucción, combinada con una determinación feroz, lo moldeó como uno de los
más grandes competidores e instructores que ha dado Japón.
En 1961 sostuvo un combate memorable contra Keigo Abe, ganando por decisión tras seis
prórrogas. En 1963 conquistó el Campeonato de Japón de la JKA frente a Hiroshi Shirai. Su estilo
de lucha, dinámico y poderoso, le valió el apodo con el que el mundo lo recuerda: Tora,
"El Tigre".

### INGLATERRA, SU SEGUNDO HOGAR
El 20 de abril de 1965, siguiendo la política de la JKA de enviar instructores al extranjero,
Enoeda viajó a Inglaterra junto a los instructores Hiroshi Shirai, Hirokazu Kanazawa y Taiji Kase.
Su destino fue Liverpool: enseñó a tiempo completo en el Red Triangle Dojo y cada mañana a las 7
entrenaba en Sefton Park con un pequeño grupo de alumnos —entre ellos Andy Sherry, Terry O'Neil,
Bob Poynton y Bill Christall—, dando el ejemplo de que hasta los campeones de Japón necesitan
entrenar todos los días.
En 1969 se casó con Reiko y se estableció en Kingston, Surrey. Como Instructor Jefe de la KUGB
(Unión de Karate de Gran Bretaña) formó a generaciones de karatekas, asistido a lo largo de los
años por instructores como Sadashige Kato, Shiro Asano, Hideo Tomita, Masao Kawasoe y Yoshinobu
Ohta.

### EL TIGRE FUERA DEL TATAMI
En 1971 participó en la película de James Bond "Diamantes para la eternidad", como uno de los
secuaces de Ernst Stavro Blofeld. En 1973 dirigió para la BBC una demostración en vivo de karate
que fue la primera transmisión británica dedicada íntegramente a este arte: kihon, kata, combate
y demostraciones ante las cámaras.
Escribió varios libros que siguen siendo referencia del Shotokan, entre ellos "Shotokan: Kata
avanzado" (1983, en tres volúmenes) y la serie "Karate Shotokan" (1996). Promocionó su dojo con
afiches de "Dynamic Karate" en el metro de Londres y enseñó en los baños Marshall Street, cerca
de Carnaby Street, hasta sus últimos días.

### SU FILOSOFÍA
Era conocido por la intensidad de su enseñanza y de su entrenamiento: el talento sin práctica
diaria no significa nada. Cuando le preguntaron si ya se acostumbraba a la comida británica,
respondió: "¡Por supuesto! ¡Ahora me siento británico!". Vivió como un caballero inglés mientras
llevaba el karate Shotokan a los más altos estándares, y amaba profundamente al pueblo que lo
recibió.

### SU LEGADO
Enoeda falleció el 29 de marzo de 2003 tras una breve enfermedad. Poco después, la JKA le otorgó
póstumamente el rango de 9º dan. Le sobreviven su esposa Reiko y sus hijos Daisuke y Maya.
Su "camino" atraviesa a los instructores y a cada generación de karatekas que lo siguieron.
ENOEDA Dojo lleva su nombre y entrena en Ecuador con esa misma premisa: técnica, constancia y
presencia, todos los días.

### DATOS CLAVE (línea de tiempo)
1935 — Nace en Kyushu, Japón. · A los 16 años, 2º dan de judo.
c. 1953 — Ingresa a la Universidad de Takushoku; shodan de karate en dos años; capitán del club.
1957-1960 — Clase de instructores de la JKA, bajo Masatoshi Nakayama.
1961 — Combate histórico contra Keigo Abe: victoria tras seis prórrogas.
1963 — Campeón de Japón de la JKA. Apodo "El Tigre".
1965 — Llega a Inglaterra (Liverpool, Red Triangle Dojo).
1969 — Se casa con Reiko; se establecen en Kingston, Surrey.
1971 — James Bond: "Diamantes para la eternidad".
1973 — Demostración para la BBC (Open Door), primera TV británica dedicada al karate.
1983 — "Shotokan: Kata avanzado" (tres volúmenes).
1985 — 8º dan.
2003 — Fallece el 29 de marzo; 9º dan póstumo.

### CTA FINAL
ENTRENA EN SU NOMBRE → inscripciones (WhatsApp / sedes).

L3 (conflictos entre fuentes, resueltos con la versión mejor respaldada — VALIDAR):
1. Quién lo inspiró en la demostración: la KUGB nombra "Senseis Irea y Okazaki" (probable error
   tipográfico); Wikipedia no los nombra. Se omitieron los nombres.
2. Año de llegada a Inglaterra: 20 de abril de 1965 (Wikipedia, fecha precisa) vs. "1966" en una
   remembranza de la KUGB. Se usó 1965.
3. Sus maestros: una versión breve dice que comenzó con Nakayama; las fuentes detalladas indican
   Funakoshi y Nakayama, y kumite con Kase. Se usó la versión detallada.
4. La sección "El Tigre fuera del tatami" (Bond, BBC, libros) es color cultural real; si se
   quiere una página más sobria, se recorta y deja solo los libros.

L4 (implementation evidence): `/legado` shipped — hero "EL TIGRE.", six narrative sections
alternating surface/muted, 12-row trajectory timeline (red years, ruled rows), closing CTA
"ENTRENA EN SU NOMBRE." with WhatsApp + sedes. Home directory Legado href → /legado; public nav
gained "El legado" (paths/navigation tests updated). 27 marketing/nav tests + full suite 1653
passed. Build OK; /legado in build output.

L5 (bug found while verifying): the dev server was serving a stale middleware bundle, so every
public content page (/el-camino, /kickboxing, /legado) 302ed to /login for anonymous visitors
(unit tests + code were correct). A dev-server restart fixed it. NOT a code bug — but worth
remembering: if a public page 302s while its tests pass, restart the dev server before
debugging code.
