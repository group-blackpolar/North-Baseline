# Task Pack 14 — NORTH Views Studio · Informe de ingeniería

Repos: NORTH (`feature/views-studio`, worktree `GBP.worktrees/north-views-studio`) y CORECROW (`feature/views-studio`, worktree
`GBP.worktrees/corecrow-views-studio`), ambos desde `origin/main` (NORTH `37f86d2`, CORECROW `42fb5c8`; incluyen los Task Packs 12 y 13).
Todo lo afirmado se verificó en código; lo que no se pudo verificar se marca como tal.

## A. Resumen ejecutivo

La auditoría (Fase 0) mostró que Views **ya tenía** un workspace administrativo (Overview, explorador de estructura, resultados,
inspector, filtros guardados), un modelo de documento persistido y versionado (`NorthPanel` → `NorthPanelRevision` inmutables con ETag,
borrador/publicado/restore, auditoría, permisos por capacidad) y un renderer publicado con bindings analíticos, filtros y presentación.
Lo que faltaba era el **editor visual**: el existente era una lista vertical de tarjetas sin posicionamiento, sin gráficos ni datos,
sin deshacer, sin validación previa a publicar y con varios defectos (formato `percentage` inválido, KPI de ejemplo con cifras
inventadas, restore de versión que no actualizaba el ETag, imágenes/archivos que no se podían guardar).

Se construyó **NORTH Views Studio** sobre ese modelo (sin segundo sistema de páginas, sin migraciones):

| Entregado | Estado |
| --- | --- |
| Editor de 3 zonas (biblioteca · lienzo · inspector), colapsable, con drawers en pantallas pequeñas | Funcional, verificado en navegador |
| Lienzo con cuadrícula de 12 columnas: arrastrar, redimensionar (5 asas), soltar desde la biblioteca, duplicar, eliminar, secciones | Funcional |
| Layout por dispositivo (escritorio / tablet / móvil) con marco de vista previa | Funcional |
| Teclado: Enter toma/suelta, flechas mueven, Mayús+flechas redimensionan, Supr, Ctrl+D, Esc, anuncios `aria-live` | Funcional |
| Deshacer / rehacer local (100 pasos, coalescencia de escritura) separado del historial persistente | Funcional |
| Biblioteca: 12 componentes añadibles (encabezado, texto, tarjeta, enlace, lista, separador, KPI, 3 gráficos, tabla, embed) | Funcional |
| Inspector por pestañas General / Apariencia / Datos / Avanzado con controles tipados | Funcional |
| Datos reales en el lienzo: conexión (binding) → dataset → campos → gráfico/KPI/tabla, con datos del dataset autorizado | Funcional |
| Crear conexiones desde el editor (dataset, agrupación, medida, filtros permitidos al lector) | Funcional |
| Autosave con cola (sin solapes), ETag, conflicto 409, recuperación ante cierre inesperado, aviso `beforeunload` | Funcional |
| Publicación con compuerta: guardado → **validación en CORECROW** → resumen de cambios vs publicado → publicar con el ETag validado | Funcional (endpoint nuevo) |
| Vista previa borrador / publicada por dispositivo | Funcional |
| Plantillas genéricas (blanco, ejecutivo, analítico, operativo, explorador, presentación) sin datos ni bindings | Funcional |
| Nombre de sección = título de escena en el modo presentación | Funcional |

Pendiente o fuera de este paquete (con motivo): ver secciones E y K.

## B. Arquitectura

```
Organization → NorthCategory → NorthSubcategory → NorthPanel ("vista")
                                                   ├─ NorthPanelRevision* (inmutables; document JSON, etag, revisionNumber)
                                                   │    draftRevisionId / publishedRevisionId  (punteros)
                                                   └─ NorthAnalyticsBinding* (consulta declarativa autorizada sobre un dataset activo)
Documento (schemaVersion 1) → sections[] {id, name?, layout{gap}} → components[] {id, type, props, bindings{data}, layout{desktop,tablet,mobile}, order}
```

* **Views** administra la experiencia visual; **Queries/datasets** aportan los datos; **CORECROW** autoriza, persiste, valida y aísla.
* El editor nunca ejecuta código del documento: los componentes son datos validados por un esquema estricto en CORECROW
  (`content-schema.ts`); el cliente repite solo comprobaciones básicas (`hasUnsafeContent`, geometría).
* Un componente enlazado guarda **solo una referencia** (`bindings.data = {sourceType:'dataset', sourceId, datasetId}`); la consulta vive en el
  binding, que CORECROW valida (dataset activo, ACL, filtros permitidos, límites).

### NORTH (nuevo / cambiado)

| Archivo | Rol |
| --- | --- |
| `features/views/studio/StudioEditor.tsx` | Orquestador: carga del borrador, recuperación, atajos, drawers, modos |
| `studio/StudioCanvas.tsx` | Lienzo: gestos de puntero (fantasma local, un solo commit al soltar), teclado, DnD de la biblioteca |
| `studio/StudioLibrary.tsx`, `StudioInspector.tsx`, `DataTab.tsx`, `StudioToolbar.tsx`, `PublishDialog.tsx`, `ComponentPreview.tsx` | UI |
| `studio/grid.ts`, `documentOps.ts`, `history.ts`, `registry.ts`, `docDiff.ts`, `bindingModel.ts`, `recovery.ts`, `defaults.ts` | **Núcleo puro y probado** (sin React ni alias) |
| `features/views/ViewsEditorContext.tsx` | Estado del editor: documento+historial en refs, `commit/edit/undo/redo`, guardado serializado |
| `features/views/viewTemplates.ts` | Plantillas genéricas (construidas con las mismas operaciones puras) |
| `locales/studio.ts` | Cadenas ES/EN (el tipo obliga a que EN defina todas las claves de ES) |
| `views/ViewsRenderer.tsx` | `SafeComponent` exportado (mismo render en editor y página), tarjeta renderizada, título de escena = nombre de sección |
| `dev/studio.html`, `dev/studio.tsx` | Arnés de desarrollo con API simulada del contrato de borrador/bindings (no se empaqueta) |

Eliminado (sustituido, no duplicado): `ViewsEditorCanvas`, `ViewsCanvasBody`, `ViewsSectionCard`, `ViewsBlockCard`, `ViewsInspectorPane`,
`InspectorComponentForm`, `ComponentLibraryModal`, `ViewsStructurePane` y nodos, `ViewsPreview`, `ViewsEditorToolbar`, `previewSafe`.
El Studio se carga **bajo demanda** (chunk propio de ~125 kB; el shell no cambia de tamaño).

### CORECROW (nuevo)

`POST /v1/organizations/:organizationId/panels/:panelId/draft/validate` — de solo lectura, `north.panel.preview`, 60/min.
Devuelve `{revisionId, revisionNumber, etag, checkedAt, valid, issues[{severity, code, message, sectionId?, componentId?}], dependencies[{kind, id, status, componentIds}]}`.
Comprueba: esquema estricto completo (assets, bindings, embeds), gráfico sin binding, binding inexistente o de otro dataset, dataset archivado o sin revisión
activa, dataset sin permiso para quien valida, campos mapeados que el binding ya no devuelve, KPI con campo pero sin binding, superposición de layout y vista vacía.
`buildDraftReport` es puro (8 pruebas); `gatherDraftFacts` obtiene los hechos con la misma autorización que `results`.
Sin migración. OpenAPI regenerado (solo adiciones).

## C. Views Manager (Tasks 14.2–14.4)

Ya existía (Task Pack 12) y se **reutilizó sin rehacer**: Overview con KPIs verificables, explorador (crear/renombrar/duplicar/mover/reordenar/archivar),
tabla/grid/lista/agrupado, filtros guardados, inspector con versiones y dependencias, estados vacíos. No se tocó. Cambios en esta área:
selector de plantillas del diálogo "Crear vista" (6 plantillas genéricas con descripción) y "Editar" abre el Studio.
**No hecho:** KPI "Pages With Errors" en el Overview (requiere validar todas las vistas; ahora existe el endpoint por vista, falta un barrido por lotes).

## D. Visual Builder (Tasks 14.5–14.8)

* **Lienzo**: la misma cuadrícula CSS que la página publicada (`auto-rows-[minmax(2rem,auto)]`), así que lo que se ve es lo que se publica. Las filas son desiguales; la
  conversión puntero→celda usa los tamaños de pista resueltos por el navegador (`getComputedStyle`).
* **Rendimiento**: durante un gesto solo se re-renderiza la capa "fantasma" (store externo + `useSyncExternalStore`); los ítems están en `memo` con acciones estables;
  el documento se confirma **una vez** al soltar y el autosave espera 1,5 s de calma. No hay escritura al backend por movimiento.
* **Colisiones**: al soltar se empujan hacia abajo los ítems solapados (determinista, solo por breakpoint editado).
* **Inspector**: General (contenido + posición/tamaño numéricos por dispositivo), Apariencia (solo lo que el esquema admite: variante, alineación, nivel, tamaño, altura por
  slider, orientación, apilado, color de serie con selector, etc.), Datos, Avanzado (id, tipo, acciones, lista de lo no soportado aún).

## E. Componentes

| Estado | Componentes |
| --- | --- |
| Funcional | Encabezado, Texto enriquecido, Tarjeta, Enlace, Lista, Separador, Indicador (KPI, estático o con datos), Gráfico de barras / líneas-área / anillo-circular (con datos), Tabla (estática o con datos), Embed (dominios permitidos por CORECROW) |
| Bloqueado deliberadamente | Imagen, Video, Archivo (requieren almacenamiento + escáner; CORECROW falla cerrado) — visibles en la biblioteca, deshabilitados con explicación |
| Pendiente (requiere ampliar el esquema CORECROW) | Container/Grid/Columns/Tabs internas/Accordion (hoy el layout es secciones + cuadrícula), Trend/Comparison KPI, Progress, Scatter, Stacked (existe como variante de barras), mapa (sin datos geográficos), filtros como componentes, Query Results/Reusable Widget/Conditional Content, nombre/descripción/visibilidad condicional/caché/etiqueta de accesibilidad/interacciones por componente |

Los filtros de lector se configuran **en la conexión** (campos permitidos y operadores por tipo) y los renderiza el `FilterBar` del Task Pack 13; no son componentes del documento.

## F. Integración de datos

Flujo: dataset → binding (crear en Datos) → componente. El lienzo ejecuta la consulta declarada del binding con el permiso del editor (`POST datasets/:id/query`, caché en memoria de 30 s
compartida entre componentes) y dibuja con los mismos componentes que la página publicada. Compatibilidad comprobada antes de enlazar (KPI/barras/líneas/anillo necesitan columna
numérica y, salvo KPI, una de categoría). Si una conexión cambia y un campo mapeado desaparece, el inspector y la validación del servidor lo señalan.
**No hecho:** campos calculados (no existen contrato ni backend), edición/borrado de bindings existentes, cross-filtering/drill-down (el contrato de consultas no expone esas operaciones; no se simula),
OR/grupos de filtros, dependencias persistidas como grafo.

## G. Publicación

Borrador → (autosave) → **Publicar**: guarda, valida en CORECROW sobre la revisión guardada, muestra errores/avisos y el resumen de cambios frente a la versión publicada (altas, bajas, movidos,
configuración, datos reconectados, secciones) y publica con el `If-Match` de la revisión validada (si el borrador cambió, el servidor responde 409 y no se sobrescribe). La publicada permanece estable mientras se edita (punteros
distintos, revisiones inmutables); historial y restore ya existían y ahora el restore conserva el ETag. **No hecho:** estados In review/Ready (requiere migración, propuesta en `docs/task-pack-12/PUBLISHING_FOUNDATION.md`),
programación efectiva, comparación visual, plantilla/bloques reutilizables compartidos.

## H. Backend

| Capacidad | Estado |
| --- | --- |
| List/Get/Create/Update draft, publish, revisions, restore, archive, duplicate (clone), reorder, search | Existente y funcional (sin cambios) |
| Bindings: list / create / update / results / facets | Existente y funcional; el Studio usa list y create |
| Datasets, fields, query | Existente y funcional |
| **Validate draft** | **Nuevo** |
| Estados de revisión (In review/Ready), aprobaciones | Falta (migración aditiva propuesta, no ejecutada) |
| Dependencias persistidas (`NorthPanelDependency`) | Falta (hoy se derivan del documento) |
| Campos calculados | Falta |
| Delete/update de binding | Falta (update existe; el Studio aún no lo ofrece) |
| Migraciones necesarias para lo entregado | **Ninguna** |

## I. Seguridad

* Ninguna ruta nueva escribe datos; `draft/validate` exige `north.panel.preview` del panel, resuelve tenant desde la membresía, no revela datasets sin permiso (reporta `DATASET_FORBIDDEN` sin metadatos) y está limitado a 60/min.
* El documento sigue sin poder contener scripts/HTML/credenciales (esquema estricto en servidor + `hasUnsafeContent` en cliente antes de guardar/publicar). Los bindings guardan referencias, no consultas ni conexiones.
* Datos del lienzo: se piden con el permiso del propio editor; CORECROW los autoriza por dataset.
* Recuperación local: `sessionStorage` por pestaña, TTL 12 h, solo el documento + ETag base (sin tokens ni credenciales); solo se ofrece si el ETag coincide con el servidor.
* Autorización efectiva siempre en CORECROW; nada del cliente (`PermissionContext`) concede acceso. Publicar sigue exigiendo `north.panel.publish`.
* Aislamiento entre tenants: el Studio vive bajo el remonte por organización (`key=organization.id`); todas las rutas incluyen `organizationId` y el binding se valida contra `organizationId+panelId`.

## J. Calidad

Ejecutado (en los worktrees): NORTH `tsc -b`, `pnpm lint` (0 errores; solo avisos preexistentes), `pnpm test` (**80/80**; 15 nuevas del Studio: cuadrícula, historial, operaciones de documento, diff, bindings, alias,
plantillas, recuperación), `pnpm build` OK. CORECROW `tsc --noEmit`, `pnpm lint`, `pnpm test:unit` (**72/72**; 8 nuevas), `pnpm openapi`, `pnpm build`.
Verificación visual en navegador contra un arnés con API simulada (`/dev/studio.html`): añadir, arrastrar, redimensionar, deshacer/rehacer, teclado, conexión de datos con gráfico real, validación,
publicación, vista previa móvil, modo compacto, tema oscuro y conflicto 409.

**No ejecutado / limitaciones:** pruebas de integración de CORECROW (requieren base `*_test`), ejecución SQL real del endpoint nuevo, recorrido autenticado contra producción, plantillas desde el diálogo
completo de la app (sin sesión), pruebas con lector de pantalla, regresión visual, perfilado de rendimiento/memoria, zoom del navegador ≠ 100 %, `prefers-reduced-motion` solo cubierto en el scroll del lienzo.
El autoscroll durante el arrastre no está implementado; los avisos por sobreescritura entre dos administradores dependen del 409 existente (no hay colaboración en tiempo real).

## K. Siguientes tareas propuestas

1. QA autenticado de extremo a extremo (crear → editar → conectar datos → publicar → restaurar) con roles Editor / Publisher / Viewer y dos tenants.
2. Migración aditiva de ciclo de revisión (`lifecycle`, `NorthPanelReview`) y tabla de dependencias, con decisión de producto (revisión obligatoria por tenant).
3. Ampliar el esquema de documento (`name`/`description`/`hidden`, `refresh/cache`, `a11yLabel`, `interactions`) y componentes de layout (Columns/Tabs/Accordion) con contratos versionados.
4. Contrato de consultas para cross-filtering / drill-down y campos calculados; después, interacciones del Studio.
5. Barrido por lotes de validación para "Pages With Errors" y View Health del Overview.
6. Bloques reutilizables y presets (copia vs. compartido), favoritos y Quick Open.

## L. Despliegue

Pendiente de autorización explícita para push, PR, merge y dispatch de workflows (regla del repositorio). Ver nota final del informe en la conversación.
