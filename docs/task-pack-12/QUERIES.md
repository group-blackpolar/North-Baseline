# Task Pack 12 — Queries: modelo, seguridad e integración con Views (P2.1–P2.3, P2.5)

## Qué existe hoy (y qué no)

| Capacidad | Estado | Respaldo |
| --- | --- | --- |
| Datasets (lista, esquema, campos, versiones, importaciones, registros) | **Implementado** | `GET …/datasets`, `/fields`, `/schema-versions`, `/imports`; registros = `COUNT` vía consulta |
| Explorador de consultas (filas / agregado, filtros tipados, orden, límite) | **Implementado** | `POST …/datasets/:id/query` (contrato declarativo acotado) |
| Resultados: tabla, resumen estadístico, gráfico, campos y tipos | **Implementado** | cliente, solo sobre filas devueltas |
| Dependencias dataset ↔ vista | **Implementado** | lectura de los borradores y de `bindings` (autoritativo) |
| Fuentes de datos (registro) | **Bloqueado por backend** | no existe registro; los bindings fallan cerrados |
| Consultas guardadas | **Bloqueado por backend** | no hay contrato de definiciones reutilizables |
| Campos calculados | **Bloqueado por backend** | requiere lenguaje de expresiones validado en servidor |

## Contrato de consulta (lo que el navegador puede pedir)

`mode: ROWS` — `fields` (1–20), `filters` (≤10), `orderBy` (≤3), `limit` (≤200), `offset`.
`mode: AGGREGATE` — `groupBy` (≤2), `measures` (1–8: COUNT, COUNT_DISTINCT, SUM, AVG, MIN, MAX con alias `^[a-z][a-z0-9_]{0,63}$`),
`filters`, `orderBy` solo por salidas (grupos/alias), `limit` (≤100).
Operadores del contrato: `EQ NE GT GTE LT LTE CONTAINS`. En la UI: `BETWEEN` = `GTE`+`LTE`; `IS NULL / IS NOT NULL` = `EQ/NE` con `null`;
`Starts with` **no** existe en el contrato y no se ofrece. Los operadores ofrecidos dependen del tipo (`queries/queryBuilder.ts`, con tests).

## Seguridad

* El navegador **no ejecuta SQL ni código**: envía un objeto declarativo (visible con el botón "Ver la solicitud").
* CORECROW decide: autenticación, tenant, ACL del dataset (`north.data.query`), campos permitidos (ids del esquema activo), operaciones,
  límites de filas/complejidad, revisión activa y auditoría.
* Un `403` se muestra como **sin permiso** (no como error de red); un fallo de red como reintento.
* Los campos calculados quedan reservados a un lenguaje de expresiones **limitado, tipado y validado en backend**; la ejecución de código
  arbitrario del usuario queda excluida del servidor principal.
* Las ejecuciones no se registran en servidor (no hay contrato): el historial del explorador es de sesión y se pierde al recargar.

## Modelo de integración con Views (P2.3)

```
Data source (pendiente) → Dataset → Saved query (pendiente) → Calculated fields (pendiente) → Analytics binding → Componente → Vista publicada
```

Ya real: **Dataset → Analytics binding (por panel, `NorthAnalyticsBinding`) → componente (`bindings`) → vista publicada**, con
resultados autorizados por `…/analytics-bindings/:id/results` y filtros en lista blanca. La pestaña *Dependencias* permite entender de
dónde vienen los datos de una página (mapa dataset → vistas y referencias rotas/archivadas); el inspector de cada vista lista sus
datasets y marca los inexistentes o archivados.

Pendiente de backend para cerrar el modelo: registro de fuentes (autoriza bindings), consultas guardadas versionadas (un binding apunta
a una consulta, no a un `dataset` pelado), campos calculados tipados, y política de caducidad/actualización de resultados.

## Preparación futura (P2.5, sin implementar SHARK)

Flujo genérico: Organización → Fuente → Importación de dataset (pipeline escaneado ya existente) → Detección de esquema (análisis ya
existente) → Consulta → Campos calculados → Componentes → Vista → Publicar. Esta intervención dejó **sin** dashboards, campos ni mocks
específicos de ninguna organización; la reconstrucción usará solo estas herramientas con datos reales importados manualmente.
