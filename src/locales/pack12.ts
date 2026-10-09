/** Task Pack 12 strings: stability, Administration, Views workspace and Queries. Spanish is the source of the key set. */
export const pack12Es = {
  'conn.title': 'No podemos conectar con el servicio',
  'conn.body': 'No pudimos contactar con CORECROW. Tu sesión no se ha cerrado; reintenta en unos segundos.',
  'conn.retry': 'Reintentar',
  'conn.retrying': 'Reintentando…',
} as const;

export const pack12En: Record<keyof typeof pack12Es, string> = {
  'conn.title': "We can't reach the service",
  'conn.body': "We couldn't reach CORECROW. You have not been signed out; try again in a few seconds.",
  'conn.retry': 'Retry',
  'conn.retrying': 'Retrying…',
};

export type Pack12Dictionary = Record<keyof typeof pack12Es, string>;
