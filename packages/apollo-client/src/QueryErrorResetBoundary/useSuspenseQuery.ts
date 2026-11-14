import {
  skipToken,
  useSuspenseQuery as useApolloClientSuspenseQuery,
  type OperationVariables,
  type SuspenseQueryHookOptions,
} from "@apollo/client";
import { useContext } from "react";

import { QueryErrorResetKeyContext } from "./QueryErrorResetBoundary";

export declare namespace useSuspenseQuery {
  export type Signature = typeof useApolloClientSuspenseQuery;
  export type Options<
    TData = unknown,
    TVariables extends OperationVariables = OperationVariables,
  > = SuspenseQueryHookOptions<TData, TVariables>;
}

export const useSuspenseQuery: useSuspenseQuery.Signature = ((
  query: Parameters<typeof useApolloClientSuspenseQuery>[0],
  options?: useSuspenseQuery.Options | typeof skipToken,
) => {
  const resetKeys = useContext(QueryErrorResetKeyContext);

  const userKey = options === skipToken ? undefined : options?.queryKey;
  const queryKey = [
    ...resetKeys,
    ...(userKey === undefined ? [] : Array.isArray(userKey) ? userKey : [userKey]),
  ];

  return useApolloClientSuspenseQuery(
    query,
    options === skipToken ? options : ({ ...options, queryKey } as never),
  );
}) as useSuspenseQuery.Signature;
