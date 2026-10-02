# Feature: footer-convenios

## Goal

Split the footer's single "CON EL RESPALDO DE" block into two blocks: **COLABORADORES** and
**CONVENIOS**, matching the asset split already done in `assets/`.

## Decisions (resolved with the user)

- Headings: `COLABORADORES` and `CONVENIOS`, each with its own short intro line.
- Order: keep current order; new entries appended in file-number order.
- Role lines: new entries have none for now (data not provided). `role` becomes optional;
  existing collaborators keep theirs. Convenios render no role line.
- KORU moved to convenios: `enoedaColaborador4.png` was deleted and `enoedaConvenio3.png`
  is byte-identical (same git blob `b824310`).

## Data

| Group | Asset | Name |
| --- | --- | --- |
| Colaborador | `enoedaColaborador3.png` | FEK Ecuador Karate |
| Colaborador | `enoedaColaborador1.png` | AKR Internacional |
| Colaborador | `enoedaColaborador2.png` | Concentración Deportiva de Pichincha |
| Colaborador | `enoedaColaborador5.png` | Asociación de Karate-Do de Pichincha |
| Colaborador | `enoedaColaborador6.png` | Confederación Mundial de Artes Marciales y Deportes de Contacto |
| Convenio | `enoedaConvenio.jpeg` | Aqua Bonsail |
| Convenio | `enoedaConvenio2.png` | Ludi Land |
| Convenio | `enoedaConvenio3.png` | KORU Rehabilitación Física y Fisioterapia |

New assets are opaque RGB with their own coloured backgrounds (not transparent like 1-3).

## Tasks

- [x] 1. Data module: split into `MARKETING_COLLABORATORS` + `MARKETING_AGREEMENTS` with intros
- [x] 2. Footer: render two labelled sections via local `PartnerSection`; update `footer.test.tsx`
- [x] 3. Verify: vitest footer + full suite, `tsc --noEmit`, eslint on touched files
- [x] 4. Work-unit commit on `feat/footer-convenios` (assets + code + tests + this doc)

Note: Ludi Land asset is `enoedaConvenio2.png` (the user's folder briefly showed a `.jpeg`;
the file on disk at implementation time is a 1254x1254 PNG).

## Verification results

| Check | Result |
| --- | --- |
| `npx vitest run components/marketing/shell/footer.test.tsx` | 6 passed |
| `pnpm test` (full suite) | 85 files passed / 1 skipped — 695 tests passed, 1 skipped |
| `npx tsc --noEmit` | clean, exit 0 |
| `npx eslint` on the 3 touched files | 0 errors, 0 warnings (moved stale `no-img-element` disable onto the `<img>` line) |
| Visual pass in browser | not run |

## Commit evidence

- `feat(marketing): split footer partners into colaboradores and convenios` on `feat/footer-convenios`.
