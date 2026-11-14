import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

export const QueryErrorResetKeyContext = createContext<ReadonlyArray<object>>([]);

export declare namespace QueryErrorResetBoundary {
  export type Props = { children: ({ reset }: { reset: VoidFunction }) => ReactNode };
}

export const QueryErrorResetBoundary = ({ children }: QueryErrorResetBoundary.Props) => {
  const parentResetKeys = useContext(QueryErrorResetKeyContext);
  const [resetKey, setResetKey] = useState<object | null>(null);

  const reset = useCallback(() => {
    setResetKey({});
  }, []);

  const value = useMemo(
    () => (resetKey === null ? parentResetKeys : [...parentResetKeys, resetKey]),
    [parentResetKeys, resetKey],
  );

  return (
    <QueryErrorResetKeyContext.Provider value={value}>
      {children({ reset })}
    </QueryErrorResetKeyContext.Provider>
  );
};
