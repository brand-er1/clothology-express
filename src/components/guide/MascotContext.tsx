import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Lets a page report local state (current wizard step, input length, etc.) to the mascot
 * without BrandGuide needing page-specific logic, and without pages rendering their own
 * mascot UI. Call useMascotPageContext(...) from a page; BrandGuide reads the latest value.
 */
type PageContext = Record<string, unknown>;

const MascotContext = createContext<{
  pageContext: PageContext;
  setPageContext: (value: PageContext) => void;
} | null>(null);

export const MascotProvider = ({ children }: { children: ReactNode }) => {
  const [pageContext, setPageContext] = useState<PageContext>({});
  return (
    <MascotContext.Provider value={{ pageContext, setPageContext }}>
      {children}
    </MascotContext.Provider>
  );
};

/** BrandGuide-side: reads whatever the current page last published. */
export const useMascotPageContextValue = (): PageContext => {
  const ctx = useContext(MascotContext);
  return ctx?.pageContext ?? {};
};

/** Page-side: publishes local state for the mascot to react to. Clears itself on unmount. */
export const useMascotPageContext = (value: PageContext) => {
  const ctx = useContext(MascotContext);
  const valueRef = useRef(value);
  valueRef.current = value;

  useEffect(() => {
    if (!ctx) return;
    ctx.setPageContext(valueRef.current);
    return () => ctx.setPageContext({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(value)]);
};
