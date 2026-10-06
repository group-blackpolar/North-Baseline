// One-off codemod: lucide-react -> @phosphor-icons/react (identifier-level, AST based).
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const root = process.argv[2];
const PHOSPHOR_DIR = path.join(root, 'node_modules/@phosphor-icons/react/dist/csr');
const available = new Set(fs.readdirSync(PHOSPHOR_DIR).filter((f) => f.endsWith('.d.ts')).map((f) => f.replace(/\.d\.ts$/, '')));

const MAP = {
  AlertCircle: 'WarningCircle', AlertTriangle: 'Warning', AlignLeft: 'TextAlignLeft', Archive: 'Archive', ArrowDown: 'ArrowDown', ArrowLeft: 'ArrowLeft', ArrowRight: 'ArrowRight',
  ArrowUp: 'ArrowUp', ArrowUpRight: 'ArrowUpRight', BadgeCheck: 'SealCheck', Bell: 'Bell', Building2: 'Buildings', CalendarDays: 'CalendarBlank', Check: 'Check', CheckCheck: 'Checks',
  CheckCircle2: 'CheckCircle', ChevronDown: 'CaretDown', ChevronRight: 'CaretRight', ChevronsUpDown: 'CaretUpDown', CircleAlert: 'WarningCircle', CircleCheck: 'CheckCircle', Clock3: 'Clock',
  Code2: 'Code', Construction: 'Barricade', Container: 'Package', Copy: 'Copy', CreditCard: 'CreditCard', Database: 'Database', Download: 'DownloadSimple', Edit2: 'PencilSimple', Edit3: 'PencilSimple',
  Eye: 'Eye', FileClock: 'ClockCounterClockwise', FilePlus2: 'FilePlus', FileText: 'FileText', Filter: 'Funnel', Folder: 'Folder', FolderPlus: 'FolderPlus', FolderX: 'FolderMinus', Gauge: 'Gauge',
  GitCompare: 'GitDiff', Globe2: 'Globe', Hand: 'Hand', HardDrive: 'HardDrive', History: 'ClockCounterClockwise', Home: 'House', Image: 'Image', ImagePlus: 'ImageSquare', Inbox: 'Tray', Info: 'Info',
  KeyRound: 'Key', Layers: 'Stack', Layers3: 'Stack', LayoutDashboard: 'SquaresFour', LayoutGrid: 'SquaresFour', LayoutTemplate: 'Layout', Link2: 'Link', List: 'List', Loader2: 'CircleNotch',
  LoaderCircle: 'CircleNotch', Lock: 'Lock', LockKeyhole: 'LockKey', LogIn: 'SignIn', LogOut: 'SignOut', Mail: 'Envelope', MailCheck: 'EnvelopeSimple', MapPin: 'MapPin', MessageCircle: 'ChatCircle',
  Minus: 'Minus', PanelBottom: 'SquareHalfBottom', PanelLeft: 'Sidebar', PanelLeftOpen: 'SidebarSimple', PanelRight: 'SquareHalf', Pencil: 'PencilSimple', Plus: 'Plus', Receipt: 'Receipt',
  RefreshCw: 'ArrowsClockwise', RotateCw: 'ArrowClockwise', Save: 'FloppyDisk', Search: 'MagnifyingGlass', Send: 'PaperPlaneTilt', Settings: 'Gear', ShieldAlert: 'ShieldWarning', ShieldCheck: 'ShieldCheck',
  Ship: 'Boat', Sliders: 'SlidersHorizontal', Square: 'Square', Table2: 'Table', TimerOff: 'Timer', Trash2: 'Trash', TriangleAlert: 'Warning', Type: 'TextT', UploadCloud: 'CloudArrowUp', UserCheck: 'UserCheck',
  UserPlus: 'UserPlus', UserRound: 'User', UserX: 'UserMinus', Users: 'Users', Users2: 'Users', UsersRound: 'Users', Video: 'Video', Waves: 'Waves', WifiOff: 'WifiSlash', X: 'X', Layers3D: 'Stack',
};
for (const [from, to] of Object.entries(MAP)) if (!available.has(to)) throw new Error(`Phosphor has no ${to} (for ${from})`);

const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (/\.(ts|tsx)$/.test(entry.name)) files.push(full);
  }
})(path.join(root, 'src'));

let changed = 0;
for (const file of files) {
  const source = fs.readFileSync(file, 'utf8');
  if (!source.includes('lucide-react')) continue;
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const imports = sf.statements.filter((node) => ts.isImportDeclaration(node) && node.moduleSpecifier.text === 'lucide-react');
  if (imports.length === 0) continue;

  const used = new Set();
  const visitAll = (node) => { if (ts.isIdentifier(node) && !imports.some((imp) => node.pos >= imp.pos && node.end <= imp.end)) used.add(node.text); ts.forEachChild(node, visitAll); };
  visitAll(sf);

  const renames = new Map(); // local identifier -> new local identifier
  const phosphorImports = new Map(); // phosphor name -> local name
  let needsIconComponent = false;
  for (const imp of imports) {
    const named = imp.importClause?.namedBindings;
    if (!named || !ts.isNamedImports(named)) throw new Error(`${file}: unsupported lucide import shape`);
    for (const spec of named.elements) {
      const imported = (spec.propertyName ?? spec.name).text;
      const local = spec.name.text;
      if (imported === 'LucideIcon') { needsIconComponent = true; renames.set(local, 'IconComponent'); continue; }
      const target = MAP[imported];
      if (!target) throw new Error(`${file}: no mapping for ${imported}`);
      let newLocal = spec.propertyName ? local : target; // an explicit alias keeps its own local name
      if (!spec.propertyName && used.has(target) && target !== local && !phosphorImports.has(target)) newLocal = `${target}Icon`;
      if (phosphorImports.has(target)) newLocal = phosphorImports.get(target); // two lucide names, one phosphor icon
      phosphorImports.set(target, newLocal);
      if (local !== newLocal) renames.set(local, newLocal);
    }
  }

  const edits = [];
  const visit = (node) => {
    if (ts.isIdentifier(node) && renames.has(node.text) && !imports.some((imp) => node.pos >= imp.pos && node.end <= imp.end)) {
      const parent = node.parent;
      const isMemberName = (ts.isPropertyAccessExpression(parent) && parent.name === node) || (ts.isPropertyAssignment(parent) && parent.name === node) || (ts.isJsxAttribute(parent) && parent.name === node) || (ts.isPropertySignature(parent) && parent.name === node) || (ts.isMethodDeclaration(parent) && parent.name === node);
      if (!isMemberName) {
        if (ts.isShorthandPropertyAssignment(parent)) edits.push([node.getStart(), node.end, `${node.text}: ${renames.get(node.text)}`]);
        else edits.push([node.getStart(), node.end, renames.get(node.text)]);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);

  const importLines = [];
  if (phosphorImports.size) importLines.push(`import { ${[...phosphorImports.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([target, local]) => (target === local ? target : `${target} as ${local}`)).join(', ')} } from '@phosphor-icons/react';`);
  if (needsIconComponent) importLines.push("import type { IconComponent } from '@/components/ui/icon';");
  // replace the first lucide import with the new lines, drop the others
  imports.forEach((imp, index) => edits.push([imp.getStart(), imp.end, index === 0 ? importLines.join('\n') : '']));

  let out = source;
  for (const [start, end, text] of edits.sort((a, b) => b[0] - a[0])) out = out.slice(0, start) + text + out.slice(end);
  fs.writeFileSync(file, out);
  changed += 1;
}
console.log(`migrated ${changed} files`);
