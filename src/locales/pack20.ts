/** Studio strings for the report cards component and the hero text fields. Spanish is the source of the key set. */
export const pack20Es = {
  'st.cmp.report_cards': 'Tarjetas de reportes', 'st.cmp.report_cards.hint': 'Tarjetas de acceso a los reportes de la organización. Cada lector ve abiertos solo los que tiene permitidos; los demás aparecen restringidos.',
  'st.rc.category': 'Reporte (categoría)', 'st.rc.categoryHelp': 'Identificador (slug) de la categoría del reporte en esta organización. La tarjeta se abre solo si el lector tiene acceso.',
  'st.rc.icon': 'Icono', 'st.rc.tone': 'Color', 'st.rc.image': 'Imagen', 'st.rc.noImage': 'Sin imagen',
  'st.rc.up': 'Subir tarjeta', 'st.rc.down': 'Bajar tarjeta', 'st.rc.remove': 'Quitar tarjeta', 'st.rc.add': 'Añadir tarjeta', 'st.rc.newReport': 'Nuevo reporte',
  'st.cmp.title_bar': 'Barra de título', 'st.cmp.title_bar.hint': 'Banda a todo el ancho con el color principal de la organización y texto blanco.', 'grid.grandTotal': 'Total general',
  'icon.picker.title': 'Elegir icono', 'icon.picker.search': 'Buscar icono…', 'icon.picker.none': 'Sin icono', 'icon.picker.empty': 'No hay iconos con ese nombre.', 'icon.picker.clear': 'Quitar icono', 'icon.label': 'Icono',
  'st.hero.eyebrow': 'Texto superior', 'st.hero.centered': 'Cabecera centrada', 'st.hero.brand': 'Mostrar el logo',
  'st.group.visibility': 'Visibilidad', 'st.vis.restrict': 'Restringir a roles o grupos', 'st.vis.help': 'Si se activa, solo reciben este bloque los miembros con alguno de estos roles o grupos.', 'st.vis.roles': 'Roles', 'st.vis.groups': 'Grupos', 'st.vis.note': 'Se aplica al publicar: el bloque no llega a quien no corresponda. No sustituye los permisos de los datos.',
  'st.lc.panel': 'Vista de la organización (slug)', 'st.lc.panelHelp': 'Slug de otra vista publicada. Rellena este campo o la URL, no ambos.', 'st.lc.url': 'URL externa', 'st.lc.urlInvalid': 'Usa una URL http, https o mailto.', 'st.lc.new': 'Nuevo enlace',
} as const;
export type Pack20Dictionary = Record<keyof typeof pack20Es, string>;
export const pack20En: Pack20Dictionary = {
  'st.cmp.report_cards': 'Report cards', 'st.cmp.report_cards.hint': 'Access cards for the organization reports. Each reader sees open only the ones they are allowed to; the rest show as restricted.',
  'st.rc.category': 'Report (category)', 'st.rc.categoryHelp': 'Identifier (slug) of the report category in this organization. The card opens only if the reader has access.',
  'st.rc.icon': 'Icon', 'st.rc.tone': 'Color', 'st.rc.image': 'Image', 'st.rc.noImage': 'No image',
  'st.rc.up': 'Move card up', 'st.rc.down': 'Move card down', 'st.rc.remove': 'Remove card', 'st.rc.add': 'Add card', 'st.rc.newReport': 'New report',
  'st.cmp.title_bar': 'Title bar', 'st.cmp.title_bar.hint': 'Full-width band in the organization primary colour with white text.', 'grid.grandTotal': 'Grand total',
  'icon.picker.title': 'Choose icon', 'icon.picker.search': 'Search icons…', 'icon.picker.none': 'No icon', 'icon.picker.empty': 'No icons match that name.', 'icon.picker.clear': 'Remove icon', 'icon.label': 'Icon',
  'st.hero.eyebrow': 'Top text', 'st.hero.centered': 'Centered header', 'st.hero.brand': 'Show the logo',
  'st.group.visibility': 'Visibility', 'st.vis.restrict': 'Restrict to roles or groups', 'st.vis.help': 'When on, only members with one of these roles or groups receive this block.', 'st.vis.roles': 'Roles', 'st.vis.groups': 'Groups', 'st.vis.note': 'Applied on publish: the block is never sent to anyone else. It does not replace data permissions.',
  'st.lc.panel': 'Organization view (slug)', 'st.lc.panelHelp': 'Slug of another published view. Fill this or the URL, not both.', 'st.lc.url': 'External URL', 'st.lc.urlInvalid': 'Use an http, https or mailto URL.', 'st.lc.new': 'New link',
};
