# Karate page (/karate)

Feature: give Karate the same public landing surface Kickboxing already has, wired from the home
entry points, using the karate photo/video set the user supplied.

## Specs

S1. The home hero button `ENTRENAR KARATE` opens the karate page itself, mirroring
    `ENTRENAR KICKBOXING` → `/kickboxing`. Verbatim: "Ahora necesitamos que el boton entrenar
    karate abra una pagina de karate en si, algo como tenemos con el boton de entrenar
    kickboxing".

S2. `/karate` is a page of its own with its own copy, not a redirect to WhatsApp.

S3. The structure may mirror `/kickboxing` and may add sections, because there is more material.
    Verbatim: "puede ser como el kickboxing o puedes implementar mas cosas porque tenemos videos
    y fotos".

S4. Photos and videos come from `C:\Users\Daryhen\Desktop\enoeda\karate`; the agent picks which
    ones. Verbatim: "te dejo elegir las foto puedes darle un vistado y eligir las que mas te
    gusten al igual con los videos".

S5. Design quality is held to the impeccable bar while staying inside the existing marketing
    world (navy `#02142a`, red `#e63946`, Bebas Neue / Archivo Narrow, 2px rules, hard shadows).
    Verbatim: "usa impecable si hace falta".

S6. (Inferred from S1, consequence) Every existing home/nav entry point that routes Karate goes to
    `/karate`: the "Dos disciplinas" card and the main navigation, so the button and the card do
    not disagree.

S7. (Derived from PRODUCT.md) No invented facts: no fabricated testimonials, numbers, federation
    ranks or tournament results. Public credentials stay as already used on the site
    (Acuerdo Ministerial 143 · Filial AFEK 035 · Concentración Deportiva de Pichincha).

## Tasks

- [x] T1 — Bring the selected photos and video into the repo (`assets/karate/`, `public/media/karate/`).
  Route: inline. Evidence: 7 photos normalized to 1600px/82% JPEG; `demostracion.mp4`
  (720x406, crf32, 81s, 7.8MB) + `demostracion.webp` poster. Not committed — user reviews
  the working tree first (same disposition as the previous change).
- [x] T2 — Build `/karate`: page route, component, content, CSS module, tests. Route: inline.
  Evidence: `karate.test.tsx` written first and observed RED (module not found), then 8/8
  green. Files: `app/(marketing)/karate/page.tsx`,
  `components/marketing/karate/{karate,karate-content,karate.module.css,karate.test}.tsx`.
- [x] T3 — Wire entry points: hero CTA, paths card, navigation, and their tests. Route: inline.
  Evidence: `hero.test.tsx`, `paths.test.tsx`, `navigation.test.ts` updated; marketing suite
  12 files / 60 tests green.
- [x] T4 — Verify. Evidence: `tsc --noEmit` clean; `eslint` clean on the touched areas; full
  suite 1786 passed, 1 pre-existing failure outside this diff
  (`lib/domain/classes/get-sessions-resolver.test.ts` hardcodes `2026-10-26`); visual check on
  localhost:3002 desktop (1440+) and mobile (390) with ego — hero, street demo, gallery,
  pillars, options and closing band all render, no horizontal overflow.
- [x] T5 — Make `/karate` publicly reachable. Defect found after T4: `PUBLIC_PATHS` in
  `lib/auth/authorize.ts` did not list the new route, so the middleware answered
  `307 -> /login?redirect=%2Fkarate` for anonymous visitors while the component tests stayed green
  (they render the component, not the route). Test added first in `middleware.test.ts`
  (RED: 1 failed of 19), then `/karate` added to `PUBLIC_PATHS` (GREEN: 133 tests across
  `middleware.test.ts` + `lib/auth/**`), and `curl` now returns `200` for `/karate` and
  `/kickboxing` alike.

## Log

L1 (user, verbatim): "vamos hacer cambios en el home y el apartado de los 3 pasos se van."

L2 (user, verbatim): "si llegas a necesitar ego, estamos trabajando en el puerto 3002 por si acaso.
Ahora necesitamos que el boton entrenar karate abra una pagina de karate en si, algo como tenemos
con el boton de entrenar kickboxing"

L3 (user, verbatim): "de karete tenemos mas fotos y videos, te dejo a ti la estructura, puede ser
como el kickboxing o puedes implementar mas cosas porque tenemos videos y fotos, te dejo elegir las
foto puedes darle un vistado y eligir las que mas te gusten al igual con los videos.
C:\Users\Daryhen\Desktop\enoeda\karate"

L4 (user, verbatim): "usa impecable si hace falta"

L5 (decision): section structure chosen — hero, el dojo en la calle (video), nuestros alumnos
(gallery), los tres pilares (kihon/kata/kumite), antes de empezar (formativo vs competencia),
cierre with wide photo and WhatsApp CTA. Karate-specific replacement of Kickboxing's
"six styles" block: the dojo teaches one discipline, so three pillars is honest and still fills
the same grid.

L6 (decision): media selection — 69 photos and 9 videos inspected; all videos are the same outdoor
street demonstration/exhibition. Chosen photos: class action on the tatami (hero), rei line,
sparring pair, kata with coach, group with medals, street parade, wide group under the arch.
Chosen video: `WhatsApp Video 2026-11-05 at 19.51.00.mp4` (landscape street kata demonstration),
transcoded for the web.

L7 (verification): after the first visual pass two defects were fixed in one batch — the closing
band scrim was so opaque (92/74/96%) that the photo was invisible, and the street photo had no
aspect box so it grew taller than the video above it. Now the desktop scrim runs left-to-right so
the group photo reads on the right, and the street photo is a 4:3 frame with object-position 30%.

L8 (finding, out of scope): the only failing test in the full suite is
`lib/domain/classes/get-sessions-resolver.test.ts`, which hardcodes `2026-10-26` as the expected
next occurrence and broke when the calendar passed that date. That file and everything under
`lib/domain/**` are untouched by this diff (`git diff HEAD` empty for both).

L9 (defect, found and fixed): the new route was not in `PUBLIC_PATHS`, so the middleware redirected
anonymous visitors to `/login`. Lesson for the next marketing page: a route is not shippable until
`PUBLIC_PATHS` lists it AND a request without a session is confirmed to answer 200 — component
tests cannot see the middleware.