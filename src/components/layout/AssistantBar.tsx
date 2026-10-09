import { AssistantLauncher } from '@/features/assistant/AssistantLauncher';

/** Slim bar at the right edge of the shell; hosts Cuervo, the NORTH assistant. (Replaces the retired split-view switcher.) */
export function AssistantBar() {
  return (
    <div className="shrink-0 h-full bg-surface border-l border-border flex flex-col items-center py-2 gap-1" style={{ width: 'var(--shell-layout-switcher)' }}>
      <div className="mt-auto flex flex-col items-center pt-2">
        <AssistantLauncher variant="bar" />
      </div>
    </div>
  );
}
