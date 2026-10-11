import { createContext, useContext } from 'react';

/**
 * True when a component sits in a fixed-matrix cell (section `rowHeight`/`fit`): it must fill the cell and scroll or
 * clip inside it instead of imposing its own height, and it may use denser spacing.
 */
const CellFillContext = createContext(false);
export const CellFillProvider = CellFillContext.Provider;
export const useCellFill = () => useContext(CellFillContext);
