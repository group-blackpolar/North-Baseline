# NORTH â€” Task Pack 12: informe tÃ©cnico final

Ramas: NORTH `feature/task-pack-12` Â· CORECROW `feature/task-pack-12`. Documentos hermanos: `ARCHITECTURE_AUDIT.md`,
`CACHING.md`, `QUERIES.md`, `PUBLISHING_FOUNDATION.md`, `LEGACY_CLEANUP.md`.

## A. Resumen ejecutivo

**Completado**

* **P0 Estabilidad**: causas raÃ­z de la expulsiÃ³n/parpadeo corregidas (4 mecanismos); la verificaciÃ³n por correo y la navegaciÃ³n
  sobreviven a cambios de app/recargas (sin guardar contraseÃ±a ni OTP).
* **CachÃ©**: capa de memoria con deduplicaciÃ³n, SWR e invalidaciÃ³n por etiqueta/Ã¡mbito; Nivel 2 (disco) y Nivel 3 (HTTP) evaluados y
  diferidos con justificaciÃ³n.
* **Administration**: 8 subcategorÃ­as integradas en el sistema existente de categorÃ­as/tabs, cargadas bajo demanda.
* **Views**: workspace completo (resumen, explorador, bÃºsqueda, filtros combinables, 4 modos de resultados, inspector, salud,
  actividad); el editor anterior se conserva detrÃ¡s de *Editar*.
* **Queries**: datasets, explorador de consultas con resultados (tabla/resumen/grÃ¡fico/esquema), dependencias datasetâ†”vistas.
* **Limpieza**: cÃ³digo/mocks/seeds/rutas de Master House y SHARK retirados en ambos repos.

**Pendiente / decisiÃ³n necesaria**

1. Autorizar (o no) las acciones sobre **datos de producciÃ³n** de la organizaciÃ³n demo (desactivar showcase pÃºblico, archivar):
   `LEGACY_CLEANUP.md Â§3`. **No se ejecutÃ³ ninguna.**
2. Backend para: registro de fuentes, consultas guardadas, campos calculados, estados *In review/Ready*, validaciÃ³n como etapa,
   cuotas/uso por tenant, polÃ­ticas de seguridad/retenciÃ³n por tenant, API keys, webhooks, conexiones externas.
3. QA autenticado con roles reales y dispositivos reales (ver H).

## B. AnÃ¡lisis de causa raÃ­z

| Bug | SÃ­ntoma | Causa raÃ­z | Archivos | CorrecciÃ³n | Prueba |
| --- | --- | --- | --- | --- | --- |
| ExpulsiÃ³n de Administration | Aparece, parpadea, vuelve a otra ubicaciÃ³n | Fallo de refresh de organizaciones â‡’ lista = `[Personal]` â‡’ cambio de `key` â‡’ remontaje total; 401 con sesiÃ³n viva ignorado | `context/OrganizationContext.tsx`, `App.tsx` | Estados `initializing/ready/error`; los fallos no destruyen la lista; 401 solo cierra sesiÃ³n si CORECROW confirma `anonymous`; `ConnectionProblem` reintentable | Navegador + API simulada: org list 503 al cargar â‡’ pantalla de reintento (no "sin acceso"); al recuperarse, entra |
| Login por fallo de red | Se muestra login/ cierra sesiÃ³n sin motivo | `getSession()` devolvÃ­a `null` para red/5xx | `lib/auth.ts`, `App.tsx`, `session/SessionGuard.tsx` | `checkSession()` triâ€‘estado; reintentos con backoff | API simulada: `get-session` 503 â‡’ pantalla de reintento, sesiÃ³n intacta; al volver, restaura |
| Permisos "denegado" al cargar | Entradas deshabilitadas un instante | `isLoading` inicial `false` | `context/PermissionContext.tsx` | Estado `loading` inicial para tenants | RevisiÃ³n de cÃ³digo + build |
| CatÃ¡logo vacÃ­o tras error | RedirecciÃ³n a la 1.Âª categorÃ­a | Rechazo sin `catch` + catÃ¡logo sobrescrito | `context/CatalogContext.tsx`, `TabsContext.tsx` | `error` explÃ­cito, conserva datos, `navigate` estable | RevisiÃ³n + navegaciÃ³n manual |
| Reinicio del login al cambiar de app | Se pierde el paso de verificaciÃ³n | Estado solo en React | `lib/authFlow.ts`, `views/Login.tsx` | Persistencia mÃ­nima en `sessionStorage` (TTL 30 min) | Navegador: paso restaurado tras recarga con cooldown; tests unitarios (4) |
| PÃ©rdida de ubicaciÃ³n al recargar | Vuelve a la 1.Âª categorÃ­a | Tabs solo en memoria | `lib/navState.ts`, `TabsContext.tsx`, `App.tsx` | Ids de tabs por usuario+org, reâ€‘resoluciÃ³n de paneles | Navegador: reanuda en la secciÃ³n; tests (3) |

## C. Cambios de arquitectura

* **Nuevos mÃ³dulos (frameworkâ€‘free, con tests `node --test`)**: `lib/apiCache.ts`, `lib/authFlow.ts`, `lib/navState.ts`,
  `lib/organizationState.ts`, `features/views/workspace/resources.ts`, `features/queries/queryBuilder.ts`,
  `features/queries/dependencies.ts`, `features/admin-center/auditModel.ts` â€” 61 tests en total pasando (19 nuevos mÃ³dulos incluidos).
* **Hooks/contextos**: `useResource`, `useElementWidth`, `useViewFilters`/`useSavedFilters`/`useRevisionInfo`, `useViewActions`,
  `useAdminNavigation`; `OrganizationContext` (+`status`), `CatalogContext` (+`error`), `TabsContext` (estado Ãºnico, `hydratePanel`).
* **Componentes**: `ConnectionProblem`, `SessionLockOverlay(reason)`, `AdminCenter` y 8 pantallas, `ViewsCenter` + workspace
  (`StructureExplorer`, `FilterPanel/FilterChips`, `ResultsPane`, `ResourceInspector`, `ContextMenu`), `QueriesCenter`, `QueryExplorer`.
* **API**: **ninguna modificaciÃ³n de contrato** (ni endpoints nuevos ni migraciones). Todo usa rutas existentes (ver auditorÃ­a).
* **Modelo de datos**: sin cambios. **Migraciones generadas**: ninguna.
* **i18n**: `locales/pack12.ts` (ES/EN con tipado que exige paridad); ~490 claves.

## D. AdministraciÃ³n â€” estado real

| SubcategorÃ­a | Estado | Respaldo / lÃ­mites |
| --- | --- | --- |
| Overview | **Implementada** | miembros, invitaciones, vistas, datasets, facturaciÃ³n, auditorÃ­a, alertas reales; almacenamiento = "pendiente de backend" |
| Members & Access | **Implementada** (consolidaciÃ³n + filtro de estado + panel contextual) | miembros, invitaciones (correo y claves), grupos, permisos; panel de usuario es de lectura |
| Views | **Implementada** | ver E |
| Queries | **Parcial** | datasets/explorador/dependencias reales; fuentes, guardadas, calculados **bloqueados por backend** |
| Integrations | **Parcial** | estado de CORECROW, conectores (importaciÃ³n manual) e historial de importaciones reales; conexiones externas, API, webhooks **bloqueados por backend** |
| Activity & Audit | **Implementada** | tabla + timeline, filtros (texto, categorÃ­a, actor, fechas) sobre eventos cargados, detalle; sin campo "resultado" (el backend no lo registra) |
| Billing & Usage | **Parcial** | plan, estimado, contacto editable, licencias, facturas; cuotas/consumo **bloqueados**; sin flujo de pago |
| Organization Settings | **Parcial** | general e identidad (existente), detalles, vista de inicio, archivar/restaurar con confirmaciÃ³n; seguridad y retenciÃ³n **bloqueadas**; "Identity & Branding" quedÃ³ unida a "General" |

## E. Views â€” informe

* **CÃ³mo funcionan las pÃ¡ginas**: ver `ARCHITECTURE_AUDIT.md Â§3` (CategorÃ­a â†’ SubcategorÃ­a â†’ Vista(panel) â†’ secciones â†’ componentes
  â†’ bindings; revisiones inmutables con punteros borrador/publicado).
* **Almacenamiento/ediciÃ³n**: PostgreSQL vÃ­a CORECROW; ediciÃ³n con autosave + ETag (`If-Match`), publicaciÃ³n explÃ­cita, historial y
  restauraciÃ³n (existentes, intactos).
* **Nuevo**: explorador jerÃ¡rquico con teclado (flechas, F2, menÃº contextual, Shift+F10), reordenar/mover/duplicar/archivar/renombrar
  con contratos reales (reordenado siempre con la lista completa de hermanos), bÃºsqueda sin acentos y multipalabra, filtros
  combinables (O dentro del grupo, Y entre grupos) sincronizados con URL y sesiÃ³n, filtros guardados (por navegador), orden,
  paginaciÃ³n, 4 modos sobre **una sola** consulta (`queryResources`), inspector con versiÃ³n/publicaciÃ³n/dependencias reales,
  responsive por **ancho del contenedor** (no del viewport).
* **No implementado (y por quÃ©)**: estados *In review/Ready/Invalid*, filtros por "creador/editor", etiquetas y "sin fuente de datos"
  (no existen en el backend o requerirÃ­an escanear todos los documentos); columna "Data source" (solo en el inspector).
  Los miniaturas/preview visuales no se inventaron. "Import Structure" no se ofrece.
* **PublicaciÃ³n**: `PUBLISHING_FOUNDATION.md` â€” la separaciÃ³n borrador/publicado y el rollback ya existen; faltan validaciÃ³n como
  etapa, revisiÃ³n/aprobaciÃ³n y programaciÃ³n efectiva (propuesta aditiva sin migraciÃ³n destructiva).

## F. Queries

Fuentes, endpoints, modelo, seguridad e integraciÃ³n: `QUERIES.md`. PrÃ³ximos pasos: registro de fuentes â†’ consultas guardadas â†’
campos calculados (lenguaje de expresiones validado en servidor) â†’ bindings que apunten a consultas.

## G. Limpieza legacy

Ver `LEGACY_CLEANUP.md`: **eliminado** (cÃ³digo/mocks/seed/rutas/workflow en ambos repos), **conservado** (pipeline y visuales
genÃ©ricos, ADRs como historia), **archivado/deshabilitado** (nada en producciÃ³n), **pendiente de autorizaciÃ³n** (showcase pÃºblico y
organizaciÃ³n demo en producciÃ³n).

## H. Pruebas

| Comando | Resultado |
| --- | --- |
| NORTH `pnpm exec tsc -b` | OK |
| NORTH `pnpm lint` | 0 errores (advertencias preexistentes de fastâ€‘refresh) |
| NORTH `pnpm test` | **61/61** (incluye 4 authFlow, 3 navState, 6 apiCache, 8 resources, 6 queryBuilder, 2 dependencies, 3 auditModel) |
| NORTH `pnpm build` | OK; entrada 1 414.74 kB (gzip 387.28) vs 1 521.93 (gzip 406.84) en `main`; `AdminCenter` 361.06 kB diferido |
| CORECROW `tsc --noEmit`, `eslint`, `pnpm build` | OK (artefactos `dist/` versionados restaurados, no se commitean) |
| CORECROW `pnpm test:unit` | **62/62** |
| CORECROW `pnpm test` (integraciÃ³n, PostgreSQL) | **No ejecutada localmente**: el PostgreSQL embebido no arrancÃ³ en este equipo. La ejecuta CI (PostgreSQL 16) antes de desplegar. Ediciones en esa suite: solo literales de texto. |
| Navegador integrado + API simulada local | AdministraciÃ³n (8 secciones sin errores de consola), Views (selecciÃ³n, inspector, filtros combinados + chips + URL), Queries (filas y agregado + grÃ¡fico), reintento ante 503 de sesiÃ³n/organizaciones, restauraciÃ³n del paso de verificaciÃ³n, escritorio/mÃ³vil sin desbordamiento de pÃ¡gina |

**No ejecutado** (lÃ­mites del entorno): Android Chrome/Safari iOS reales, suspensiÃ³n real de pestaÃ±as, BFCache real, caducidad real de
OTP, roles reales OWNER/ADMIN/MEMBER y multiâ€‘tenant contra CORECROW de producciÃ³n, pruebas de accesibilidad con lector de pantalla,
mediciÃ³n de renders/memoria/hitâ€‘rate. La API simulada es solo una herramienta local (no se versiona ni se despliega) y no sustituye al
QA autenticado.

## I. Siguientes tareas recomendadas

1. **PublicaciÃ³n completa de Views** (validaciÃ³n â†’ revisiÃ³n â†’ listo â†’ publicar/programar), segÃºn `PUBLISHING_FOUNDATION.md`.
2. **Editor visual avanzado** (arrastre/rejilla, previsualizaciÃ³n responsive, selector de datasets por binding).
3. **Consultas guardadas y campos calculados** (contratos + lenguaje de expresiones).
4. **ImportaciÃ³n de datos** hacia infraestructura externa de almacenamiento/escÃ¡ner y *smoke* con archivo real.
5. **ReconstrucciÃ³n limpia de SHARK** exclusivamente con herramientas genÃ©ricas.
6. QA autenticado multiâ€‘rol/multiâ€‘tenant; mÃ©tricas reales de cachÃ©; quitar `OrganizationAdminView`/`PanelEditor` tras QA.
