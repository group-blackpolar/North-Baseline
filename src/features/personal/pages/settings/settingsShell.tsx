import { useI18n } from '@/lib/i18n';
import { AppearanceSection } from './AppearanceSection';
import { LanguageSection } from './LanguageSection';

const VALID_SECTIONS = [
  'appearance',
  'language-region',
];

/** Settings sin sidebar interno: la navegación vive en el SubcategorySidebar global.
 *  Contenido centrado con ancho de lectura cómodo. */
export function SettingsShell({ sub }: { sub: string }) {
  const { t } = useI18n();
  const active = VALID_SECTIONS.includes(sub) ? sub : 'appearance';

  const content = (() => {
    switch (active) {
      case 'appearance': return <AppearanceSection />;
      case 'language-region': return <LanguageSection />;
      default: return <AppearanceSection />;
    }
  })();

  return (
    <div className="flex-1 flex justify-center overflow-y-auto">
      <div className="w-full max-w-3xl p-6 space-y-4">
        <h1 className="text-xl font-display font-semibold text-text">{t('settings.title')}</h1>
        {content}
      </div>
    </div>
  );
}
