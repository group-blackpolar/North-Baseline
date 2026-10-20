import {
  Airplane, AirplaneTilt, Anchor, Archive, ArrowsClockwise, ArrowsLeftRight, Atom, Bank, Barcode, Basket, Bell, Binoculars, BookOpen, Bookmarks, BookmarkSimple, Boat, Briefcase, Buildings, Calculator, CalendarBlank,
  Certificate, ChartBar, ChartDonut, ChartLineUp, ChartPie, ChartScatter, ChatCircleText, CheckCircle, Clock, ClockCounterClockwise, ClipboardText, Cloud, Code, Coins, Compass, Cpu, Crane, CurrencyDollar, Cube, Database,
  DownloadSimple, Drop, Envelope, Eye, Factory, Files, Fingerprint, Fire, Flag, Flask, Folder, FileText, FolderOpen, Funnel, Gauge, Gear, GitBranch, GlobeHemisphereWest, Graph, HardDrives, Handshake, Heart, Hourglass, House,
  IdentificationCard, Image, Info, Key, Leaf, Lifebuoy, Lightbulb, Lightning, Link, ListBullets, ListChecks, Lock, MagnifyingGlass, MapPin, MapPinArea, MapTrifold, Medal, MegaphoneSimple, Microscope, Mountains, Network,
  Newspaper, Notebook, Notepad, Package, Palette, Path, Percent, PersonSimpleCircle, Phone, Pulse, PuzzlePiece, Question, RoadHorizon, RocketLaunch, Receipt, Sailboat, Scales, Scroll, Seal, Shield, ShieldCheck, ShoppingCart,
  Siren, SlidersHorizontal, Snowflake, SquaresFour, Stack, Star, Storefront, Sun, Table, Tag, Target, TerminalWindow, Train, Translate, TreeStructure, TrendDown, TrendUp, Trophy, Truck, UploadSimple, User, UserCircle,
  UsersThree, Wallet, Warehouse, WarningCircle, Wrench, PlugsConnected,
} from '@phosphor-icons/react';
import type { IconComponent } from '@/components/ui/icon';

export type IconGroup = 'general' | 'logistics' | 'data' | 'people' | 'documents' | 'time' | 'tools' | 'ideas';
export interface CatalogIcon { key: string; icon: IconComponent; es: string; en: string; group: IconGroup }

export const ICON_GROUPS: Array<{ id: IconGroup; es: string; en: string }> = [
  { id: 'general', es: 'General', en: 'General' }, { id: 'logistics', es: 'Logística y comercio', en: 'Logistics and trade' },
  { id: 'data', es: 'Datos y finanzas', en: 'Data and finance' }, { id: 'people', es: 'Personas y contacto', en: 'People and contact' },
  { id: 'documents', es: 'Documentos', en: 'Documents' }, { id: 'time', es: 'Tiempo', en: 'Time' },
  { id: 'tools', es: 'Herramientas y sistema', en: 'Tools and system' }, { id: 'ideas', es: 'Ideas y naturaleza', en: 'Ideas and nature' },
];

const g = (group: IconGroup, rows: Array<[string, IconComponent, string, string]>): CatalogIcon[] => rows.map(([key, icon, es, en]) => ({ key, icon, es, en, group }));

/**
 * The icon vocabulary a category, subcategory or view can use. The KEY is what CORECROW stores (`icon`, free text up to 100 characters), so keys
 * are stable: they include every name already stored or used by the document schema (ship, users, info, list, calendar, anchor, pin, ...).
 */
export const ICON_CATALOG: CatalogIcon[] = [
  ...g('general', [
    ['home', House, 'Inicio', 'Home'], ['layout', SquaresFour, 'Cuadrícula', 'Grid'], ['star', Star, 'Estrella', 'Star'], ['flag', Flag, 'Bandera', 'Flag'], ['bookmark', BookmarkSimple, 'Marcador', 'Bookmark'],
    ['heart', Heart, 'Favorito', 'Favorite'], ['bolt', Lightning, 'Rayo', 'Lightning'], ['bell', Bell, 'Notificaciones', 'Notifications'], ['info', Info, 'Información', 'Information'],
    ['help', Question, 'Ayuda', 'Help'], ['warning', WarningCircle, 'Advertencia', 'Warning'], ['check', CheckCircle, 'Verificado', 'Verified'], ['lock', Lock, 'Candado', 'Lock'], ['key', Key, 'Llave', 'Key'],
    ['shield', Shield, 'Escudo', 'Shield'], ['shield-check', ShieldCheck, 'Seguridad', 'Security'],
  ]),
  ...g('logistics', [
    ['ship', Boat, 'Barco', 'Ship'], ['sailboat', Sailboat, 'Velero', 'Sailboat'], ['anchor', Anchor, 'Ancla', 'Anchor'], ['container', Package, 'Contenedor', 'Container'], ['package', Cube, 'Paquete', 'Package'],
    ['truck', Truck, 'Camión', 'Truck'], ['plane', Airplane, 'Avión', 'Airplane'], ['plane-tilt', AirplaneTilt, 'Vuelo', 'Flight'], ['train', Train, 'Tren', 'Train'], ['warehouse', Warehouse, 'Almacén', 'Warehouse'],
    ['buildings', Buildings, 'Edificios', 'Buildings'], ['factory', Factory, 'Fábrica', 'Factory'], ['crane', Crane, 'Grúa', 'Crane'], ['barcode', Barcode, 'Código de barras', 'Barcode'], ['scale', Scales, 'Balanza', 'Scales'],
    ['receipt', Receipt, 'Recibo', 'Receipt'], ['tag', Tag, 'Etiqueta', 'Tag'], ['cart', ShoppingCart, 'Carrito', 'Cart'], ['store', Storefront, 'Tienda', 'Store'], ['basket', Basket, 'Canasta', 'Basket'],
    ['handshake', Handshake, 'Acuerdo', 'Deal'], ['globe', GlobeHemisphereWest, 'Mundo', 'World'], ['compass', Compass, 'Brújula', 'Compass'], ['map', MapTrifold, 'Mapa', 'Map'], ['pin', MapPin, 'Ubicación', 'Location'],
    ['pin-area', MapPinArea, 'Zona', 'Area'], ['road', RoadHorizon, 'Ruta', 'Route'], ['path', Path, 'Trayecto', 'Path'], ['binoculars', Binoculars, 'Prospección', 'Scouting'], ['lifebuoy', Lifebuoy, 'Soporte', 'Support'],
  ]),
  ...g('data', [
    ['chart', ChartLineUp, 'Tendencia', 'Trend chart'], ['bars', ChartBar, 'Barras', 'Bars'], ['pie', ChartPie, 'Circular', 'Pie'], ['donut', ChartDonut, 'Dona', 'Donut'], ['scatter', ChartScatter, 'Dispersión', 'Scatter'],
    ['trend', TrendUp, 'Crecimiento', 'Growth'], ['trend-down', TrendDown, 'Descenso', 'Decline'], ['table', Table, 'Tabla', 'Table'], ['database', Database, 'Base de datos', 'Database'], ['stack', Stack, 'Capas', 'Layers'],
    ['filter', Funnel, 'Filtro', 'Filter'], ['calculator', Calculator, 'Calculadora', 'Calculator'], ['percent', Percent, 'Porcentaje', 'Percent'], ['dollar', CurrencyDollar, 'Dólar', 'Dollar'], ['coins', Coins, 'Monedas', 'Coins'],
    ['bank', Bank, 'Banco', 'Bank'], ['wallet', Wallet, 'Cartera', 'Wallet'], ['gauge', Gauge, 'Indicador', 'Gauge'], ['pulse', Pulse, 'Actividad', 'Activity'], ['graph', Graph, 'Grafo', 'Graph'], ['network', Network, 'Red', 'Network'],
  ]),
  ...g('people', [
    ['user', User, 'Usuario', 'User'], ['users', UsersThree, 'Equipo', 'Team'], ['user-circle', UserCircle, 'Perfil', 'Profile'], ['id-card', IdentificationCard, 'Identificación', 'ID card'], ['briefcase', Briefcase, 'Maletín', 'Briefcase'],
    ['accessibility', PersonSimpleCircle, 'Accesibilidad', 'Accessibility'], ['chat', ChatCircleText, 'Conversación', 'Chat'], ['mail', Envelope, 'Correo', 'Mail'], ['phone', Phone, 'Teléfono', 'Phone'], ['megaphone', MegaphoneSimple, 'Anuncio', 'Announcement'],
  ]),
  ...g('documents', [
    ['document', FileText, 'Documento', 'Document'], ['folder', Folder, 'Carpeta', 'Folder'], ['folder-open', FolderOpen, 'Carpeta abierta', 'Open folder'], ['book', BookOpen, 'Libro', 'Book'], ['note', Notebook, 'Cuaderno', 'Notebook'],
    ['clipboard', ClipboardText, 'Portapapeles', 'Clipboard'], ['list', ListBullets, 'Lista', 'List'], ['checklist', ListChecks, 'Lista de tareas', 'Checklist'], ['scroll', Scroll, 'Registro', 'Log'], ['news', Newspaper, 'Noticias', 'News'],
    ['files', Files, 'Archivos', 'Files'], ['archive', Archive, 'Archivo', 'Archive'], ['notepad', Notepad, 'Bloc', 'Notepad'], ['bookmarks', Bookmarks, 'Guardados', 'Saved'],
  ]),
  ...g('time', [
    ['calendar', CalendarBlank, 'Calendario', 'Calendar'], ['clock', Clock, 'Reloj', 'Clock'], ['history', ClockCounterClockwise, 'Historial', 'History'], ['hourglass', Hourglass, 'Pendiente', 'Pending'],
  ]),
  ...g('tools', [
    ['settings', Gear, 'Configuración', 'Settings'], ['wrench', Wrench, 'Herramienta', 'Tool'], ['sliders', SlidersHorizontal, 'Ajustes', 'Adjustments'], ['plug', PlugsConnected, 'Integración', 'Integration'], ['code', Code, 'Código', 'Code'],
    ['terminal', TerminalWindow, 'Terminal', 'Terminal'], ['branch', GitBranch, 'Rama', 'Branch'], ['tree', TreeStructure, 'Estructura', 'Structure'], ['cloud', Cloud, 'Nube', 'Cloud'], ['link', Link, 'Enlace', 'Link'],
    ['search', MagnifyingGlass, 'Búsqueda', 'Search'], ['eye', Eye, 'Vista', 'View'], ['download', DownloadSimple, 'Descarga', 'Download'], ['upload', UploadSimple, 'Carga', 'Upload'], ['languages', Translate, 'Idiomas', 'Languages'],
    ['palette', Palette, 'Paleta', 'Palette'], ['image', Image, 'Imagen', 'Image'], ['puzzle', PuzzlePiece, 'Módulo', 'Module'], ['cpu', Cpu, 'Procesador', 'Processor'], ['drive', HardDrives, 'Servidor', 'Server'],
    ['seal', Seal, 'Sello', 'Seal'], ['certificate', Certificate, 'Certificado', 'Certificate'], ['fingerprint', Fingerprint, 'Huella', 'Fingerprint'], ['siren', Siren, 'Alerta', 'Alert'], ['refresh', ArrowsClockwise, 'Actualizar', 'Refresh'],
    ['exchange', ArrowsLeftRight, 'Intercambio', 'Exchange'],
  ]),
  ...g('ideas', [
    ['bulb', Lightbulb, 'Idea', 'Idea'], ['rocket', RocketLaunch, 'Lanzamiento', 'Launch'], ['target', Target, 'Objetivo', 'Target'], ['trophy', Trophy, 'Trofeo', 'Trophy'], ['medal', Medal, 'Medalla', 'Medal'],
    ['fire', Fire, 'Fuego', 'Fire'], ['leaf', Leaf, 'Hoja', 'Leaf'], ['sun', Sun, 'Sol', 'Sun'], ['drop', Drop, 'Gota', 'Drop'], ['mountains', Mountains, 'Montañas', 'Mountains'], ['snowflake', Snowflake, 'Copo', 'Snowflake'],
    ['atom', Atom, 'Átomo', 'Atom'], ['flask', Flask, 'Laboratorio', 'Lab'], ['microscope', Microscope, 'Análisis', 'Analysis'],
  ]),
];

/** Names stored before this catalog (case-insensitive) that map onto a catalog key. */
const ALIASES: Record<string, string> = { db: 'database', filetext: 'document', 'file-text': 'document' };
const BY_KEY = new Map(ICON_CATALOG.map((entry) => [entry.key, entry]));

export const catalogEntry = (name?: string | null): CatalogIcon | undefined => {
  const key = (name ?? '').trim().toLowerCase();
  return BY_KEY.get(ALIASES[key] ?? key);
};
