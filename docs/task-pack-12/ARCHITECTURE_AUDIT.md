# Task Pack 12 — Auditoría de arquitectura (Fase 0 y P1.9)

Fuente: código de `North-BP` y `CoreCrow-BP` en `origin/main` (NORTH `0163222`, CORECROW `5149871`) al iniciar la intervención. Todo lo
afirmado aquí se verificó en el repositorio; lo que no se pudo verificar se marca como tal.

## 1. Estado de partida relevante

| Área | Hallazgo |
| --- | --- |
| Shell | `App.tsx` → `I18nProvider` → `AppInner` (sesión, términos) → `ErrorProvider` → `SessionGuard` → `NotificationProvider` → `OrganizationProvider` → `AuthenticatedRouter` → `AppShell` (`key={activeOrganization.id}`) → `WorkspaceProvider` → `CatalogProvider` → `PermissionProvider` → `TabsProvider` → … |
| Navegación | Una sola: categoría → subcategoría → tab. El rail de categorías y `ContextSidebar` leen `CatalogContext`; las tabs viven en `TabsContext`. |
| Administración | Pantallas de acceso (`access-admin`) + editor de Views (`features/views`) colgadas de la categoría de servidor `admin`. |
| Plataforma | `/workspace/admin/*` (`PlatformAdminView`), fuera del árbol de organización, gate por `user.role` (ADMIN/SUPERADMIN) en cliente y autorización en CORECROW. |
| Datos | Datasets inmutables por revisión, consultas declarativas acotadas, bindings por panel (`NorthAnalyticsBinding`). No hay registro de fuentes ni consultas guardadas. |

## 2. Causas raíz de los fallos P0 (síntoma → causa → corrección)

### 2.1 Administration parpadea y devuelve al usuario a otra ubicación

El síntoma no tiene una causa única; se encontraron **cuatro mecanismos** que producen exactamente "aparece, parpadea y vuelve":

1. **`OrganizationContext.loadOrganizations` convertía cualquier error no‑401 en "solo Personal".** Un refresh (p. ej. tras guardar la
   configuración de la organización, que llama `refresh()`) que recibía un 5xx, un 429 o un corte de red reemplazaba la lista por
   `[Personal]` y movía `activeOrganization` a Personal. Con `key={activeOrganization.id}` el shell se **remontaba completo** y el
   usuario aterrizaba en Personal. Un 401 con la sesión ya establecida se ignoraba en silencio y producía lo mismo.
2. **`getSession()` devolvía `null` para cualquier fallo** (red, 5xx, 429). En el arranque eso mostraba el **login**; en
   `SessionGuard.resume` ejecutaba `onLogout()` por un simple fallo de red.
3. **Estado de carga ambiguo en permisos**: `PermissionProvider.isLoading` iniciaba en `false` y `permissions` en `[]`, de modo que
   "aún no cargado" era indistinguible de "denegado" (subcategorías de Administration deshabilitadas durante unos instantes).
4. **`CatalogProvider` sin `catch`**: un fallo de red dejaba un rechazo no manejado y el catálogo vacío, y `CatalogSync` reaccionaba
   re‑ruteando la tab a la primera categoría. `TabsContext.navigate` además cambiaba de identidad con cada cambio de tab, relanzando
   los efectos que lo consumen.

Corrección (archivos: `lib/auth.ts`, `context/OrganizationContext.tsx`, `components/session/*`, `context/PermissionContext.tsx`,
`context/CatalogContext.tsx`, `context/TabsContext.tsx`, `App.tsx`):

* `checkSession()` devuelve `authenticated | anonymous | unreachable`. **`unreachable` nunca cierra sesión ni muestra login**: el
  arranque reintenta (2 veces con backoff) y luego ofrece una pantalla "Reintentar" (`ConnectionProblem`).
* Máquina de estados de organización: `initializing → ready | error`. Un fallo **nunca** degrada una lista ya cargada: se conservan
  organizaciones, tenant activo y ubicación. Un 401 solo cierra sesión si `checkSession()` confirma `anonymous`. Un primer fallo en
  una ruta de organización muestra `ConnectionProblem` (un error de API **no** se presenta como "no eres miembro" ni "no encontrado").
* `SessionGuard`: revalida al volver del segundo plano (`visibilitychange` ≥ 30 s oculto, `pageshow` persistido) con
  `checkSession()`; `unreachable` se ignora; `anonymous` abre el estado **Session expired** (distinto de inactividad).
* Permisos: inician en `loading` para tenants reales; un fallo conserva lo último conocido.
* Catálogo: `error` explícito, conserva el catálogo anterior, solo el primer load muestra skeleton; `navigate` estable.

Estados pedidos: Initializing (`checkingSession`/`isLoading`), Loading (skeletons contextuales), Authorized (shell), Forbidden
(estados vacíos por recurso, `useResource` → `forbidden`), Session Expired (`SessionLockOverlay reason="expired"`), Error
(`ConnectionProblem` / `ErrorState`).

### 2.2 Perder el paso de verificación al cambiar de app (móvil)

* El paso (`mode`), el correo y el cooldown de reenvío vivían solo en estado React; si el navegador descartaba la página, el login
  reiniciaba. Ahora `lib/authFlow.ts` guarda **solo** `{modo, correo, resendAt, expiresAt}` en `sessionStorage` (memoria en Tauri),
  TTL 30 min, **sin contraseña, sin código OTP, sin tokens**; se borra al salir del paso.
* La navegación (`lib/navState.ts`) persiste ids de tabs + tab activa por **usuario+organización** en `sessionStorage`, TTL 12 h.
  Los documentos publicados nunca se guardan: `RestoredPanels` vuelve a resolverlos con CORECROW (un panel revocado o archivado no
  vuelve). Se limpia en logout y cambio de usuario.

## 3. Jerarquía real de páginas (P1.9)

```
Organization (tenant)
└── NorthCategory        (scope ORGANIZATION|PLATFORM|PERSONAL · resourceKind SYSTEM|CONTENT · categoryClass SYSTEM|TEMPLATE|CUSTOM)
    └── NorthSubcategory
        └── NorthPanel   ("vista": status DRAFT|PUBLISHED|ARCHIVED · audienceType · accessPolicyMode · visibility)
            ├── NorthPanelRevision*   (inmutables; document JSON; etag; revisionNumber; publishAt/unpublishAt)
            │     panel.draftRevisionId / panel.publishedRevisionId  ← punteros
            ├── NorthAnalyticsBinding* (consulta autoritativa sobre un dataset activo)
            └── grants / audiencia (roles, grupos, permisos, membresías)
Documento de panel (JSON versionado, schemaVersion 1)
└── sections[]  (id, order, layout grid + gap)
    └── components[] (id, type, props, layout desktop/tablet/mobile, order)
        └── bindings{}  ({ sourceType:'dataset', sourceId = bindingId, datasetId } | { sourceType:'metric' })
```

La hipótesis del Task Pack (Organization → Category → Subcategory → Page/Panel → Section → Component → Data Binding) **es
correcta**; "Page" y "Panel" son la misma entidad (en NORTH se llama *vista*).

### Qué se guarda dónde

| Dato | Dónde | Autoridad |
| --- | --- | --- |
| Taxonomía, paneles, revisiones, audiencia, grants, bindings | PostgreSQL vía CORECROW | CORECROW |
| Borrador / publicado | Punteros `draftRevisionId` / `publishedRevisionId` a revisiones inmutables | CORECROW |
| Datasets, esquema, revisiones de datos, ACL | PostgreSQL vía CORECROW | CORECROW |
| Tabs abiertas, tab activa | `sessionStorage` (solo ids) | cliente, efímero |
| Filtros de Views | URL + `sessionStorage`; filtros guardados en `localStorage` | cliente, por persona |
| Tema, idioma, preferencias de rail | `localStorage` | cliente |
| Lectura de caché | Memoria (`apiCache`) | nunca autoritativa |
| Solo visual | Densidad, colapsado de paneles, modo de visualización | cliente |

### Contratos usados (todos preexistentes; no se creó API paralela)

`GET /v1/organizations/:id/north/management-tree`, `…/navigation`, `…/panels/:id` (+`/draft` `PATCH` con `If-Match`, `/publish`,
`/revisions`, `/revisions/:rev/restore`, `/audience`), `POST …/north/reorder`, `…/north/clone`, `PATCH …/categories|subcategories|panels`,
`POST …/archive`, `GET …/north/search`, `GET …/audit`, `GET …/members|invitations|groups`, `GET …/billing|subscriptions|entitlements`,
`GET …/datasets` (+ `/fields`, `/imports`, `/schema-versions`), `POST …/datasets/:id/query`, `PATCH /v1/organizations/:id/status`,
`PUT …/home-panel`, `GET /v1/health`.

### Restricciones y relaciones relevantes

* `@@unique([subcategoryId, slug])` y `[organizationId, slug]` para categorías; alias de slug para renombrados.
* Los recursos `SYSTEM` son de solo lectura (`SYSTEM_RESOURCE_PROTECTED`).
* Borrador y publicado se separan por construcción: editar crea una revisión nueva; la publicada no cambia.
* Los bindings fallan **cerrados** hasta que exista un registro autoritativo de fuentes.

### Legacy / riesgos / faltantes

* `OrganizationAdminView.tsx` y `PanelEditor.tsx` (rollback muerto): se **conservan** (la documentación del repo exige quitarlos solo tras QA
  autenticado; no se hizo QA con cuentas reales en esta intervención).
* Dos lockfiles (`pnpm-lock.yaml`, `package-lock.json`): CI usa pnpm; sin reconciliar.
* Sin suite E2E del frontend; la verificación visual se hizo contra una API simulada local (no en producción).
* Faltan: registro de fuentes, consultas guardadas, campos calculados, estados de revisión (`In review`/`Ready`), validación previa a
  publicar, programación efectiva (`publishAt`/`unpublishAt` se almacenan; no hay planificador verificado), cuotas/uso por tenant,
  políticas de seguridad y retención por tenant, claves de API, webhooks y registro de conexiones.

## 4. Separación de autoridad (P2.6)

| | Plataforma | Organización |
| --- | --- | --- |
| Ruta | `/workspace/admin/*` (`PlatformAdminView`) | categoría `admin` del tenant (`AdminCenter`) |
| Providers | Fuera de `OrganizationProvider`/remount | Dentro del tenant (`key=organization.id`) |
| Gate de cliente | `user.role ∈ {ADMIN, SUPERADMIN}` (solo navegación) | `PermissionContext` (solo navegación) |
| Autoridad real | CORECROW (`/v1/platform/*`, rol global) | CORECROW (`/v1/organizations/:id/*`, membresía + permisos) |

Verificado: `AdminCenter` solo llama a `/v1/organizations/:id/*`; `PlatformAdminView` solo a `/v1/platform/*`. Un administrador de
organización no hereda guards globales. Ningún guard de plataforma se reutiliza para operaciones de tenant.
