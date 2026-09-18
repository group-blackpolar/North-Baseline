/** Limpieza de estado local de sesión/usuario + kill-switch de sesión.
 *  Se ejecuta SIEMPRE, incluso si el servidor no responde (fallback garantizado).
 *  NOTE: no toca preferencias de UI (tema, idioma) — no son estado de autenticación. */

const AUTH_STORAGE_KEYS = [
  'north-open-tabs-v2',
  'north-demo-orgs-v1',
  'north-active-org',
  'north-active-ws',
];

const SESSION_KILLED_KEY = 'north-session-killed-v1';

export function clearLocalSession(): void {
  // 1) Cookies visibles desde JS (las HttpOnly las invalida el endpoint de logout)
  try {
    document.cookie.split(';').forEach((cookie) => {
      const name = cookie.split('=')[0]?.trim();
      if (!name) return;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`;
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/; domain=${window.location.hostname}`;
    });
  } catch {
    /* storage no disponible */
  }

  // 2) Storage: solo claves de auth/estado de usuario
  try {
    AUTH_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    sessionStorage.clear();
  } catch {
    /* storage no disponible */
  }
}

/** Kill-switch: mientras exista, el boot de App ignora getSession().
 *  Demo-guard hasta verificar la invalidación server-side de CoreCrow.
 *  TODO: eliminar cuando /v1/auth/sign-out esté confirmado end-to-end. */
export function markSessionKilled(): void {
  try {
    localStorage.setItem(SESSION_KILLED_KEY, String(Date.now()));
  } catch {
    /* storage no disponible */
  }
}

export function isSessionKilled(): boolean {
  try {
    return localStorage.getItem(SESSION_KILLED_KEY) !== null;
  } catch {
    return false;
  }
}

export function clearSessionKilled(): void {
  try {
    localStorage.removeItem(SESSION_KILLED_KEY);
  } catch {
    /* storage no disponible */
  }
}