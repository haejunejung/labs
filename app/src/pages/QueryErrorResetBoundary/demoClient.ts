import {
  ApolloClient,
  ApolloLink,
  HttpLink,
  InMemoryCache,
  type SuspenseQueryHookFetchPolicy,
} from "@apollo/client";

export type RequestLogEntry = { seq: number; bookId: string; failed: boolean };

export type DemoState = {
  failuresLeft: Record<string, number>;
  log: RequestLogEntry[];
};

export const createDemoStore = () => {
  let state: DemoState = { failuresLeft: {}, log: [] };
  const listeners = new Set<() => void>();
  const set = (next: DemoState) => {
    state = next;
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    addFailure: (bookId: string) =>
      set({
        ...state,
        failuresLeft: { ...state.failuresLeft, [bookId]: (state.failuresLeft[bookId] ?? 0) + 1 },
      }),
    takeRequest: (bookId: string) => {
      const left = state.failuresLeft[bookId] ?? 0;
      const failed = left > 0;
      set({
        failuresLeft: { ...state.failuresLeft, [bookId]: failed ? left - 1 : 0 },
        log: [...state.log, { seq: state.log.length + 1, bookId, failed }],
      });
      return failed;
    },
  };
};

export type DemoStore = ReturnType<typeof createDemoStore>;

export const createDemoClient = (store: DemoStore, fetchPolicy: SuspenseQueryHookFetchPolicy) => {
  const failureInjector = new ApolloLink((operation, forward) => {
    const failed = store.takeRequest(String(operation.variables["id"]));
    operation.setContext(({ headers = {} }: { headers?: Record<string, string> }) => ({
      headers: {
        ...headers,
        "x-mock-delay": "600",
        ...(failed ? { "x-mock-error": "server" } : {}),
      },
    }));
    return forward(operation);
  });

  return new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([failureInjector, new HttpLink({ uri: "/graphql" })]),
    defaultOptions: { watchQuery: { fetchPolicy } },
  });
};
