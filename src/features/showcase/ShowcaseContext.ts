import { createContext, useContext } from 'react';

/** Organization slug while rendering the anonymous showcase; null everywhere else. */
export const ShowcaseContext = createContext<string | null>(null);
export const useShowcaseSlug = () => useContext(ShowcaseContext);
