# Task Pack 12 — Ciclo de vida de publicación (P1.10)

## Lo que ya existe (verificado en CORECROW)

| Capacidad objetivo | Estado | Evidencia |
| --- | --- | --- |
| Borradores independientes | **Existe** | `NorthPanel.draftRevisionId` ≠ `publishedRevisionId`; `PATCH /panels/:id/draft` con `If-Match` crea una revisión nueva |
| Una vista publicada no cambia al editar el borrador | **Existe** | Las revisiones son inmutables; solo `POST …/publish` mueve `publishedRevisionId` |
| Historial de versiones | **Existe** | `GET …/revisions`, `revisionNumber`, `createdBy`, `createdAt`, `message` |
| Rollback | **Existe** | `POST …/revisions/:rev/restore` (crea una revisión nueva con ese contenido; no reescribe historia) |
| Concurrencia | **Existe** | ETag por revisión; 409 `REVISION_CONFLICT` |
| Permisos de publicación | **Existe** | capacidad `north.panel.publish` (por ámbito) |
| Auditoría | **Existe** | acciones auditadas en el servicio |
| Preview | **Existe** | `north.panel.preview` + `PublishedPanel` en el editor |
| Dependencias de recursos | **Parcial** | bindings validados al guardar/publicar; sin grafo persistido |
| Programación | **Parcial** | `publishAt`/`unpublishAt` se aceptan y guardan; no se verificó planificador que los ejecute |
| **Validación como etapa** | **Falta** | solo validación de esquema al guardar |
| **Review / Ready** | **Falta** | no hay estados ni aprobaciones |
| Archivado de revisiones | n/a | los paneles se archivan; las revisiones se conservan |

## Lo implementado en esta intervención (sin estados falsos)

* El **inspector** muestra *versión de borrador*, *versión publicada*, *última publicación*, *revisiones* y el aviso de que publicar es una
  acción explícita (datos reales de `/revisions` y del árbol).
* "Cambios sin publicar" se **deriva** de ids reales (`draftRevisionId ≠ publishedRevisionId` con panel `PUBLISHED`) y alimenta KPIs,
  filtro "Revisar publicaciones" y la salud del workspace.
* Los estados **In review / Ready / Invalid** **no se muestran** como si existieran; el filtro explica que aún no existen en el backend.
  "Invalid" tampoco se infiere en cliente (sería una validación no autoritativa).

## Propuesta técnica para el resto (requiere backend; no se ejecuta migración)

```
Draft ──validate──▶ Validated ──request──▶ In review ──approve──▶ Ready ──publish──▶ Published ──archive──▶ Archived
   ▲                                          │ reject                                    │ restore (nueva revisión)
   └──────────────────────────────────────────┴───────────────────────────────────────────┘
```

1. **Modelo** (migración aditiva, sin tocar filas existentes): `NorthPanelRevision.lifecycle` (`DRAFT|VALIDATED|IN_REVIEW|READY`) y
   tabla `NorthPanelReview` (`revisionId`, `requestedBy`, `decidedBy`, `decision`, `note`, `decidedAt`). `NorthPanel.status` no cambia
   (`DRAFT|PUBLISHED|ARCHIVED`): el ciclo de revisión es **por revisión**, así la publicada nunca queda ambigua.
2. **Validación como endpoint** `POST …/revisions/:id/validate` → informe tipado (esquema, referencias de assets, bindings/datasets
   existentes y activos, permisos de datos de la audiencia). Es la fuente de "Invalid" y de "Views with Errors".
3. **Reglas**: publicar exige `READY` si la organización activa "revisión obligatoria" (flag por tenant); quien solicita no aprueba
   (separación de funciones); aprobar requiere `north.panel.publish`.
4. **Programación**: worker con lease/claim (mismo patrón que el worker de datasets) que ejecuta `publishAt`/`unpublishAt`, con
   auditoría y reintentos.
5. **Dependencias**: tabla derivada `NorthPanelDependency(revisionId, kind, targetId)` escrita al guardar; habilita
   "qué rompe archivar este dataset" sin escanear documentos.
6. **Compatibilidad**: todo es aditivo. El editor actual sigue funcionando; las nuevas columnas son nulas para revisiones antiguas
   (`lifecycle = NULL` ≡ comportamiento actual). No hay migración destructiva ni ruta de datos que reescribir.

**Decisiones que necesitan al responsable de producto**: ¿revisión obligatoria por defecto o por tenant?, ¿quién puede aprobar?,
¿programación en esta etapa o después?
