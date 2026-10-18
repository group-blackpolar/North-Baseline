/** Dataset Groups strings. Spanish is the source of the key set; English must define every key (enforced by the type below). */
export const pack18Es = {
  'dg.tab': 'Grupos', 'dg.title': 'Grupos de datasets', 'dg.hint': 'Colecciones lógicas de datasets por período, cliente o fuente. Cada dataset sigue siendo independiente.',
  'dg.new': 'Nuevo grupo', 'dg.empty': 'Aún no hay grupos', 'dg.emptyBody': 'Crea un grupo para organizar datasets por período y añadir meses nuevos sin recargar el histórico.',
  'dg.col.name': 'Grupo', 'dg.col.datasets': 'Datasets', 'dg.col.period': 'Cobertura', 'dg.col.rows': 'Filas', 'dg.col.size': 'Archivos', 'dg.col.health': 'Salud', 'dg.col.lastImport': 'Última importación',
  'dg.health.OK': 'Correcto', 'dg.health.ISSUES': 'Con incidencias', 'dg.health.EMPTY': 'Vacío', 'dg.archived': 'Archivado', 'dg.none': 'Sin período',
  'dg.create.title': 'Crear grupo', 'dg.create.name': 'Nombre', 'dg.create.slug': 'Identificador', 'dg.create.category': 'Categoría (opcional)', 'dg.create.tags': 'Etiquetas (separadas por coma)', 'dg.create.submit': 'Crear grupo',
  'dg.section.overview': 'Resumen', 'dg.section.datasets': 'Datasets', 'dg.section.audit': 'Historial de auditoría', 'dg.section.settings': 'Ajustes',
  'dg.ds.add': 'Añadir dataset', 'dg.ds.pick': 'Dataset', 'dg.ds.pickNone': 'Elige un dataset sin grupo', 'dg.ds.start': 'Inicio del período', 'dg.ds.end': 'Fin del período', 'dg.ds.label': 'Etiqueta (opcional)',
  'dg.ds.none': 'Este grupo no tiene datasets visibles para ti.', 'dg.ds.remove': 'Quitar del grupo', 'dg.ds.noneFree': 'Todos los datasets ya pertenecen a un grupo.',
  'dg.ds.overlap': 'El período se solapa con otros datasets del grupo. Un solapamiento suele duplicar datos al consultar el grupo.', 'dg.ds.overlapConfirm': 'Añadir de todos modos',
  'dg.ds.removeNote': 'Quitar un dataset del grupo no borra sus datos ni sus archivos.',
  'dg.audit.empty': 'Sin eventos registrados todavía.',
  'dg.archive': 'Archivar grupo', 'dg.restore': 'Restaurar grupo', 'dg.delete': 'Eliminar grupo',
  'dg.delete.title': 'Eliminar el grupo «{name}»', 'dg.delete.scope': 'Se elimina solo el grupo (registro lógico). Los {datasets} datasets miembros se desvinculan y conservan sus datos y archivos.',
  'dg.delete.bindings': 'Hay {bindings} vínculos analíticos en {panels} paneles que usan estos datasets; no se modifican.', 'dg.delete.running': 'Hay importaciones en curso: espera a que terminen o cancélalas.',
  'dg.delete.needArchive': 'Archiva el grupo antes de eliminarlo.', 'dg.delete.confirm': 'Eliminar grupo',
  'dg.saved': 'Cambios guardados.',
} as const;

export type Pack18Dictionary = Record<keyof typeof pack18Es, string>;

export const pack18En: Pack18Dictionary = {
  'dg.tab': 'Groups', 'dg.title': 'Dataset groups', 'dg.hint': 'Logical collections of datasets by period, client or source. Each dataset stays independent.',
  'dg.new': 'New group', 'dg.empty': 'No groups yet', 'dg.emptyBody': 'Create a group to organize datasets by period and add new months without reloading the history.',
  'dg.col.name': 'Group', 'dg.col.datasets': 'Datasets', 'dg.col.period': 'Coverage', 'dg.col.rows': 'Rows', 'dg.col.size': 'Files', 'dg.col.health': 'Health', 'dg.col.lastImport': 'Last import',
  'dg.health.OK': 'Healthy', 'dg.health.ISSUES': 'Has issues', 'dg.health.EMPTY': 'Empty', 'dg.archived': 'Archived', 'dg.none': 'No period',
  'dg.create.title': 'Create group', 'dg.create.name': 'Name', 'dg.create.slug': 'Identifier', 'dg.create.category': 'Category (optional)', 'dg.create.tags': 'Tags (comma separated)', 'dg.create.submit': 'Create group',
  'dg.section.overview': 'Overview', 'dg.section.datasets': 'Datasets', 'dg.section.audit': 'Audit history', 'dg.section.settings': 'Settings',
  'dg.ds.add': 'Add dataset', 'dg.ds.pick': 'Dataset', 'dg.ds.pickNone': 'Pick a dataset without a group', 'dg.ds.start': 'Period start', 'dg.ds.end': 'Period end', 'dg.ds.label': 'Label (optional)',
  'dg.ds.none': 'This group has no datasets visible to you.', 'dg.ds.remove': 'Remove from group', 'dg.ds.noneFree': 'Every dataset already belongs to a group.',
  'dg.ds.overlap': 'The period overlaps other datasets in the group. Overlap usually double-counts data when the group is queried.', 'dg.ds.overlapConfirm': 'Add anyway',
  'dg.ds.removeNote': 'Removing a dataset from the group does not delete its data or files.',
  'dg.audit.empty': 'No events recorded yet.',
  'dg.archive': 'Archive group', 'dg.restore': 'Restore group', 'dg.delete': 'Delete group',
  'dg.delete.title': 'Delete group "{name}"', 'dg.delete.scope': 'Only the group (a logical record) is deleted. The {datasets} member datasets are detached and keep their data and files.',
  'dg.delete.bindings': '{bindings} analytics bindings across {panels} panels use these datasets; they are not modified.', 'dg.delete.running': 'Imports are running: wait for them to finish or cancel them.',
  'dg.delete.needArchive': 'Archive the group before deleting it.', 'dg.delete.confirm': 'Delete group',
  'dg.saved': 'Changes saved.',
};
