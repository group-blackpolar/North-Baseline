import type { Locale } from '@/lib/i18n';

/** BCP-47 tag used for every number/date presentation of the interface (display only, never for calculation). */
export const intlTag = (locale: Locale | string): string => (locale === 'es' ? 'es-419' : locale === 'en' ? 'en-US' : locale);
