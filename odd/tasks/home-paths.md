# Feature: home-paths

## Goal

Step 1 of the user's roadmap: the home defines the institutional message and routes the visitor
toward Karate or Kickboxing, with a six-entry directory using the user's copy verbatim. Steps 2
(legado page) and 3 (karate-do page) come later; their cards point at today's destinations until
those pages exist.

## Specs

S1 — The home gains a directory section with the user's six entries verbatim (title + description):
"Legado del Sensei Keinosuke Enoeda / Biografía, trayectoria, filosofía y legado histórico.",
"Karate-do / Kihon, kata, kumite, grados y competición.", "Kickboxing / Técnica, acondicionamiento
físico y combate.", "Nuestro equipo / Tu trayectoria, instructores y comunidad Enoeda.",
"Sedes y horarios / Ubicaciones, clases, edades y horarios vigentes.", "Eventos y contacto / Copa
Enoeda, actividades, WhatsApp e inscripciones."

S2 — Destinations today: Legado → `#dojo` (history section; real page is roadmap step 2).
Karate-do → WhatsApp with a karate-specific message (no page yet; step 3). Kickboxing →
`/kickboxing`. Nuestro equipo → `#maestros`. Sedes y horarios → `#sedes`. Eventos y contacto →
general WhatsApp URL.

S3 — The section encodes the institutional hierarchy: the two disciplines (Karate-do,
Kickboxing) are the primary pair; the other four entries form a secondary index. Copy and design
make "karate o kickboxing" the visible choice.

S4 — The hero directs the visitor to the two disciplines: two CTAs ("ENTRENAR KARATE" → WhatsApp
karate message, "ENTRENAR KICKBOXING" → /kickboxing) join the institutional credentials line.
The existing headline and WhatsApp contact stay reachable (contact card S1).

S5 — The section follows the marketing identity: navy surface, red accent, 2px foreground
borders, hard offset shadows, Bebas display + Archivo Narrow body, uppercase display copy,
`es-EC` Spanish. Responsive to mobile; whole card is the tap target; visible focus; section and
headings accessible (`aria-labelledby`).

## Tasks

- [ ] T1 — `MARKETING_WHATSAPP_KARATE_URL` in shared/contact (S2, S4)
- [ ] T2 — Paths section component + styles + page wiring (S1-S3, S5)
- [ ] T3 — Hero: two discipline CTAs (S4)
- [ ] T4 — Tests: six entries verbatim, hrefs, hierarchy (S1-S4)
- [ ] T5 — Verify: suite, build, live desktop + mobile screenshots

## Log

L1 (user, verbatim): "vamos a trabajar un poquito en le home, tengo un texto que debemos
implementar" + the six entries + "Primero: página principal. Definir el mensaje institucional y
dirigir al visitante hacia karate o kickboxing. Segundo: legado histórico. … Tercero: karate-do. …"

L2 (scope decision): user chose option A — home only this round; legado and karate-do pages are
later steps. Their cards point at today's destinations (S2) and get updated when their pages ship.

L3 (design): directory reads as two doors + four rooms, matching the user's own step-1
instruction. Not a numbered list: the six entries are an index, not a sequence.
