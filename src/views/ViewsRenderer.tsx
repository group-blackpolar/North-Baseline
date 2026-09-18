import type { SessionUser } from '@/lib/auth';
import type { Tab } from '@/context/TabsContext';
import { EmptyState } from '@/components/ui/empty-state';
import { Construction } from 'lucide-react';
import { SharkView } from '@/features/shark/SharkView';
import { PersonalView } from '@/features/personal/PersonalView';

// IDs de categorías especiales
const PERSONAL_CATEGORIES = new Set(['home', 'profile', 'billing', 'preferences', 'settings']);
const SHARK_CATEGORIES = new Set(['shark-home', 'master-house']);



/** ViewRenderer principal: rutea según categoryId. */
export function ViewRenderer({ user, tab }: { user: SessionUser; tab: Tab | null }) {
  if (!tab) {
    return (
      <div className="flex-1 flex items-center justify-center text-text-muted text-sm">
        Selecciona una categoría para comenzar
      </div>
    );
  }
    if (PERSONAL_CATEGORIES.has(tab.route.categoryId)) {
    return <PersonalView route={tab.route} user={user} />;
  }


  if (SHARK_CATEGORIES.has(tab.route.categoryId)) {
    return <SharkView route={tab.route} />;
  }

  // Fallback para categorías desconocidas
  return (
    <div className="p-6">
      <EmptyState
        icon={Construction}
        title="Vista en construcción"
        body={`La categoría "${tab.route.categoryId}" está siendo preparada.`}
        className="max-w-md"
      />
    </div>
  );
}