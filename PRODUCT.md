# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Teachers (profesores)** — use the app daily on a phone, inside the dojo, during or right after class. Main jobs: open today's class on the calendar and take attendance; record fines and warnings (conducta); look up a student.
- **Admins (administradores)** — use the app daily on a desktop computer, from an office or home. Main jobs: manage students and enrollments, validate monthly payments, maintain class schedules and rosters, staff, belt requirements, and conduct records for their branch.
- **Owner** — occasional desktop use to manage branches (sucursales), disciplines and belt/level catalogs. Separate shell under `/owner`.
- **Students** — role-less accounts that see their own profile and conduct under `/student`. Not a daily-use audience.

## Product Purpose

Internal academic management platform for ENOEDA Dojo, a Karate and Kickboxing club in Quito, Ecuador, with several branches (Carapungo, San José de Morán, San Juan de Calderón). It replaces paper attendance and ad-hoc payment tracking with one shared record per branch. Success: a teacher takes attendance in seconds on a phone, and an admin sees who must pay, who is suspended, and what needs action today without hunting.

## Operating Context

- Branch-scoped: admins and teachers work inside one active branch at a time (branch switcher in the header).
- Rituals: classes follow recurring weekly schedules and one-time classes; attendance is taken per session; monthly payments drive enrollment suspension with a grace period; belts advance after a required number of sessions per level.
- Teachers work standing up on a mat, one hand busy, often in a gym with uneven lighting.

## Capabilities and Constraints

- Next.js 16 App Router, React 19, Tailwind CSS 4, shadcn components on `@base-ui/react` (not Radix), lucide icons, TanStack Table, Supabase auth + Postgres.
- All user-facing copy is Spanish for Ecuador (`es-EC`, `America/Guayaquil`), formal "usted" register in the app; vocabulary is centralized in `lib/localization/es-ec.ts` (Sucursal, Estudiante, Cédula, Disciplina, Horarios de clases, Multas y llamados de atención).
- Branches, disciplines, belts/levels and prices are database data, not hardcoded.
- Single theme for the authenticated app (decided 2026-10-16): the light/dark toggle will be removed.
- Tests assert visible text and DOM structure (`querySelector` + `textContent`), so labels and structure are part of the contract.

## Brand Commitments

- Name: ENOEDA Dojo. Logo: `assets/Logo Enoeda Dojo_Rojo.png` (red).
- The public marketing site (`app/(marketing)`) has its own identity (navy `#02142a`, red `#e63946`, Bebas Neue / Archivo Narrow). Decided 2026-10-16: the authenticated app gets its **own new visual identity**, not the marketing one.
- Credentials used publicly: Acuerdo Ministerial 143 · Filial AFEK 035 · Concentración Deportiva de Pichincha.

## Evidence on Hand

- Real domain vocabulary and states in `lib/localization/es-ec.ts`; feature history in `odd/tasks/*.md`.
- No product analytics, usage metrics, or user testimonials exist; do not fabricate them.

## Product Principles

1. The phone at the mat is the hardest case: teacher flows must work one-handed, fast, and legibly.
2. Show what needs action first (overdue payments, unsuspended students, today's classes) before totals.
3. One branch, one truth: every screen makes the active branch obvious.
4. Status is meaning: scheduled / completed / suspended, paid / grace / overdue, fine / warning must read consistently everywhere.
