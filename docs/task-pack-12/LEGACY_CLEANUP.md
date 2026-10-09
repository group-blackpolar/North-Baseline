# Task Pack 12 — Retiro del trabajo provisional de Master House / SHARK (P2.4)

Regla aplicada: **código y mocks se retiran; datos persistentes no se tocan** sin autorización específica.

## 1. Inventario y clasificación

### Código / recursos de repositorio (retirados — reversibles con `git revert`)

| Repo | Recurso | Clase | Acción |
| --- | --- | --- | --- |
| NORTH | `src/features/shark/**` (SharkView, 4 páginas, `mocks.ts`, `service.ts`, `types.ts`) | mock exclusivo | **Eliminado** |
| NORTH | `src/components/dashboard/charts.tsx` (Donut/TrendLine/GroupedBar con campos `containers/teus`) | solo lo usaba SHARK; vocabulario de dominio | **Eliminado** (los visuales genéricos viven en `features/analytics`) |
| NORTH | `lib/demo/store.ts`, `lib/demo/catalogs.ts` — organización/workspace demo `shark`, catálogo Master House | mock | **Eliminado** (queda solo Personal y orgs demo personalizadas) |
| NORTH | `ViewsRenderer` — rutas `shark-home`/`master-house` | ruta específica | **Eliminada** |
| NORTH | locale `shark.*`, ejemplos "SHARK-KEY-…", `dev/harness.ts` | referencia visible | **Reemplazado** por ejemplos neutros |
| CORECROW | `src/seed-tenant-demo.ts`, `src/seed-master-house-pages.ts`, `src/fixtures/master-house-june-2026.json`, `scripts/build-demo-fixture.mjs` | seed + fixture | **Eliminado** |
| CORECROW | operación `seed-master-house-demo` y entrada `viewer_emails` de `deploy.yml`; scripts `seed:/validate:tenant-demo`; copia de `fixtures` en `build.mjs` | despliegue/seed | **Eliminado** |
| CORECROW | `tests/master-house-pages.test.ts` | prueba exclusiva del seed | **Eliminado** |
| CORECROW | `scripts/build-shark-test-xlsx.mjs` + `smoke-xlsx-driver.mjs` + textos de pruebas | fixture sintético del *pipeline genérico* | **Conservado y renombrado** a `build-sample-import-xlsx.mjs` / "Sample" |
| CORECROW | ADR 018 / 019 | historia de decisiones | **Conservados**, marcados como *retirados* |

### Conservado deliberadamente (genérico)

Pipeline de importación escaneado, datasets, consultas declarativas, bindings y filtros en lista blanca, `features/analytics/*`
(KPI/tabla/gráficos), `PublishedPanel`, showcase público (la *función*), `dashboard/primitives`.

## 2. Datos persistentes en producción — NO modificados

El seed (workflow `37049485448`, 2026-10-02) creó en producción, aislado en una organización de demostración:

* la organización (slug **`shark`** según ADR‑018/workflow; **`master-house-demo`** según `CURRENT_STATE.md` — *las fuentes discrepan:
  verificar el slug real antes de actuar*);
* un dataset activo con su revisión (≈6 632 filas según `CURRENT_STATE.md`) e importación registrada;
* paneles publicados (resumen de junio + páginas del reporte) y bindings analíticos autoritativos;
* **opt‑in de showcase público activo** (lectura anónima de esos paneles por diseño del ADR‑019);
* entradas de auditoría del seed.

Esta intervención **no** ejecutó ninguna mutación de producción. Por tanto, **la experiencia de producción puede seguir mostrando esa
organización a quienes ya son miembros**; el retiro del *código* no la elimina.

## 3. Runbook propuesto (requiere autorización explícita, una por una)

Orden de menor a mayor impacto. Todas las acciones 1–2 son **reversibles**.

1. **Desactivar el showcase público** (corta la lectura anónima inmediatamente):
   `PATCH /v1/organizations/{orgId}/public-showcase` `{ "enabled": false }` — por el propietario, auditado.
2. **Archivar la organización**: `PATCH /v1/organizations/{orgId}/status` `{ "status": "ARCHIVED" }` (propietario). Se puede
   restaurar con `{ "status": "ACTIVE" }` (Administración → Configuración → Zona de peligro, ya disponible en NORTH).
3. **Respaldo previo a cualquier borrado**: `scripts/backup-vps.sh` (dump completo) más export acotado a esa organización.
4. **Borrado irreversible** (NO recomendado ahora): requiere decisión escrita, el respaldo del punto 3, y un procedimiento de CORECROW
   que respete las relaciones `onDelete: Restrict` (hoy no existe un "borrar organización"; no se creó uno).

No se eliminaron organizaciones, usuarios, facturación, auditoría ni datasets reales.

## 4. Verificación

* NORTH: `grep -ri "shark\|master house"` sobre el repo (sin `node_modules`/`dist`) → **0 coincidencias**; `pnpm lint`, `tsc`, tests y
  `pnpm build` pasan; el chunk de entrada bajó de 1 521.93 kB a 1 414.74 kB.
* CORECROW: quedan referencias únicamente en ADR 018/019 (historia) y en un texto de prueba; `tsc`, `eslint`, `pnpm build`
  (artefactos de `dist/` restaurados) y `pnpm test:unit` (62/62) pasan. **La suite de integración no pudo ejecutarse localmente**
  (PostgreSQL embebido no arrancó en este equipo); la valida CI (`check.yml`, PostgreSQL 16).
* El catálogo de Personal y la navegación administrativa se verificaron en el navegador contra una API simulada local.

## 5. Para reconstruir después

Usar solo herramientas genéricas: importar datos reales por el pipeline escaneado → esquema detectado → consultas → vistas →
publicar (ver `QUERIES.md`). No recrear mocks ni campos específicos de una organización.
