export type AppErrorCode =
  | 'API_UNAVAILABLE'
  | 'AUTH_ERROR'
  | 'PERMISSION_DENIED'
  | 'WORKSPACE_UNAVAILABLE'
  | 'ORGANIZATION_UNAVAILABLE'
  | 'SESSION_EXPIRED'
  | 'UNEXPECTED';

export interface AppError {
  id: string;
  code: AppErrorCode;
  detail?: string;
}

/** Clasifica errores de fetch/red/HTTP hacia códigos de aplicación */
export function classifyError(error: unknown): AppErrorCode {
  if (error && typeof error === 'object') {
    const status = (error as { status?: number }).status;
    if (status === 401) return 'SESSION_EXPIRED';
    if (status === 403) return 'PERMISSION_DENIED';
    if (status !== undefined && status >= 500) return 'API_UNAVAILABLE';
    const name = (error as { name?: string }).name;
    if (name === 'TypeError') return 'API_UNAVAILABLE'; // fetch fallido (red/CORS)
  }
  return 'UNEXPECTED';
}