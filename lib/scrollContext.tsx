import { createContext, useContext } from 'react';

// Lets a screen ask its dashboard layout's scroll container to jump to the
// top — needed because the layout's ScrollView is the real scroller, not
// the window or a screen's own ScrollView.
export const ScrollToTopContext = createContext<() => void>(() => {});

export function useScrollToTop() {
  return useContext(ScrollToTopContext);
}
