import { useState } from 'react';
import { List, Stack } from '@phosphor-icons/react';
import { IconButton } from '@/components/ui/icon-button';
import { Icon } from '@/components/ui/icon';
import { NavigationDrawer } from '@/components/mobile/NavigationDrawer';
import { TabSwitcher } from '@/components/mobile/TabSwitcher';
import { tabMeta } from '@/components/tabs/TabBar';
import { useCatalog } from '@/context/CatalogContext';
import { useOrganization } from '@/context/OrganizationContext';
import { useTabs } from '@/context/TabsContext';
import { useI18n } from '@/lib/i18n';
import type { SessionUser } from '@/lib/auth';

/** Phone / portrait-tablet header: menu, current view, open-views switcher. Replaces rails, breadcrumb and tab strip. */
export function MobileHeader({ user }: { user: SessionUser }) {
  const { t } = useI18n();
  const { activeTab, tabs } = useTabs();
  const { getCategory, getSubcategory } = useCatalog();
  const { activeOrganization } = useOrganization();
  const [menu, setMenu] = useState(false);
  const [switcher, setSwitcher] = useState(false);
  const title = activeTab ? tabMeta(activeTab, getCategory, getSubcategory, (key) => t(key as never)).title : 'NORTH';

  return (
    <>
      <header className="box-content flex h-12 shrink-0 items-center gap-1 border-b border-border bg-surface px-2 pt-[env(safe-area-inset-top)]">
        <IconButton label={t('shell.openMenu')} icon={<List size={20} />} onClick={() => setMenu(true)} />
        <div className="min-w-0 flex-1 px-1">
          <h1 className="truncate font-display text-[15px] font-semibold leading-tight text-text">{title}</h1>
          {activeOrganization && <p className="truncate text-[11px] leading-tight text-text-muted">{activeOrganization.name}</p>}
        </div>
        <button type="button" aria-label={t('tabs.switcher', { n: tabs.length })} onClick={() => setSwitcher(true)} className="relative flex size-(--touch-min) items-center justify-center rounded-lg text-text-secondary hover:bg-surface-hover hover:text-text">
          <Icon icon={Stack} size="lg" />
          <span className="absolute right-1 top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">{tabs.length}</span>
        </button>
      </header>
      <NavigationDrawer open={menu} onOpenChange={setMenu} user={user} />
      <TabSwitcher open={switcher} onOpenChange={setSwitcher} />
    </>
  );
}
