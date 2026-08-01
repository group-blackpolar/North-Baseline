// Detecta si la app corre dentro de Tauri (desktop) o en navegador (web).
// En web, expandWindow() no hace nada — el "expand" se simula solo con CSS.
export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function expandWindow() {
  if (!isTauri()) return
  const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window')
  const win = getCurrentWindow()
  await win.setResizable(true)
  await win.setMinSize(new LogicalSize(960, 640))
  await win.setSize(new LogicalSize(1280, 800))
  await win.center()
}
