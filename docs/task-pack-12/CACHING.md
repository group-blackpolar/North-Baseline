# Task Pack 12 — Estrategia de caché y rendimiento (P1.1)

Principio: **CORECROW conserva la autoridad**. La caché solo evita repetir lecturas idénticas; nunca decide acceso.

## Niveles

| Nivel | Estado | Decisión |
| --- | --- | --- |
| 1 · Memoria (`lib/apiCache.ts`) | **Implementado** | Deduplicación de peticiones simultáneas, TTL, *stale‑while‑revalidate* acotado, invalidación por etiqueta, límite de 300 entradas (LRU), estadísticas (`hits/staleHits/misses/deduped/evictions`). |
| 2 · Persistente (IndexedDB) | **Diferido a propósito** | Los recursos cacheables (navegación, permisos, organizaciones, árbol) están ligados a usuario y tenant y son baratos de re‑pedir. Persistirlos en disco deja datos de una persona en un equipo compartido tras cerrar el navegador y obliga a un esquema de versionado/expiración/cifrado que hoy no justifica el beneficio. Se reevaluará con medición real (p. ej. páginas publicadas pesadas). Lo que sí se persiste (en `sessionStorage`) son **ids de navegación**, no datos. |
| 3 · HTTP | **Evaluado** | CORECROW emite ETag en revisiones de paneles (ya usado para concurrencia). Peticiones condicionales para recursos generales requieren `Cache-Control`/`ETag` por ruta en backend: se recomienda como siguiente paso, no se tocó el contrato. Ya se aprovechan: deduplicación y revalidación en segundo plano en cliente. |

## Clasificación de recursos cacheados

| Recurso | Sensibilidad | TTL fresco | SWR | Etiquetas | Invalida |
| --- | --- | --- | --- | --- | --- |
| `GET /v1/organizations` | media (membresías) | 5 s | no | `orgs` | cualquier escritura a organizaciones/invitaciones/commerce; `refresh()` fuerza |
| `…/navigation` | media (por permisos) | 15 s | 120 s | `org:<id>` | cualquier escritura del tenant (publicar, reestructurar, roles…) |
| `…/permissions` | alta (capacidades) | 10 s | 50 s | `org:<id>` | cualquier escritura del tenant (rol, grants, grupos) |
| `…/north/management-tree` | media | 10 s | no | `org:<id>` | escrituras del tenant |
| `…/panels/:id/revisions` | media | 20 s | no | `org:<id>` | escrituras del tenant |
| `…/datasets`, `/fields` | media | 20–30 s | 60 s | `org:<id>` | escrituras del tenant |
| Billing / suscripciones / entitlements | alta | 15 s | no | `org:<id>` | escrituras del tenant |
| Auditoría, miembros, invitaciones, resultados de consulta | alta / volátil | **no se cachean** | — | — | — |

Cada clave incluye el id de inspección de plataforma; los paths ya contienen el id del tenant. El caché se **vacía** al cerrar sesión
(`clearLocalSession`), al cambiar de usuario (`apiCache.setScope(user.id)`) y descarta las respuestas que estaban en vuelo cuando
ocurrió una escritura o un cambio de ámbito (no repueblan con datos previos).

## Invalidación

Logout · cambio de usuario · cambio de tenant (paths distintos + remontado por `key`) · cambio de permisos/rol/grupos · actualización de
organización · edición/publicación/restauración de paneles · eliminación/archivado · cambios de esquema (todas son escrituras bajo
`/v1/organizations/:id/…` → etiqueta `org:<id>`). Revocación de acceso: la siguiente lectura es denegada por CORECROW y el error se
muestra; una entrada obsoleta solo sirve (máx. 50 s con SWR) para *pintar*, y toda acción vuelve a ser autorizada por el servidor.

## Rendimiento (mediciones reales, no estimaciones)

Compilación de producción (`pnpm build`), mismo toolchain, antes = `origin/main` `0163222`, después = esta rama:

| Métrica | Antes | Después |
| --- | --- | --- |
| Chunk de entrada JS | 1 521.93 kB (gzip 406.84 kB) | **1 414.74 kB (gzip 387.28 kB)** → −107.2 kB (−7.0 %), gzip −19.6 kB (−4.8 %) |
| Chunk diferido `AdminCenter` | — | 361.06 kB (gzip 78.89 kB), solo se descarga al abrir Administración |
| CSS | 72.85 kB | 79.40 kB |

La reducción del chunk de entrada proviene de cargar Administración bajo demanda y de retirar los mocks/vistas provisionales.
No se midieron tiempos de navegación, tasa de aciertos ni memoria en dispositivos reales: **no se declara ninguna mejora porcentual
en esos ejes**. `apiCache.stats()` expone contadores para medirlos en un entorno con tráfico real.

Otras mejoras de estabilidad con efecto en rendimiento: `TabsContext.navigate` ahora es estable (menos re‑ejecución de efectos),
`CatalogProvider` solo muestra skeleton en la primera carga, y las pantallas de Administración reutilizan lecturas deduplicadas.
