import {
  ApolloClient,
  ApolloLink,
  InMemoryCache,
  type DocumentNode,
  type SuspenseQueryHookFetchPolicy,
} from "@apollo/client";
import { jest } from "@jest/globals";
import { MockLink, type MockedResponse } from "@apollo/client/testing";

export const createTestClient = (
  mocks: ReadonlyArray<MockedResponse> = [],
  {
    autoDisposeTimeoutMs,
    fetchPolicy,
  }: {
    autoDisposeTimeoutMs?: number;
    fetchPolicy?: SuspenseQueryHookFetchPolicy;
  } = {},
) => {
  const requests: string[] = [];
  const requestLogger = new ApolloLink((operation, forward) => {
    requests.push(operation.operationName);
    return forward(operation);
  });

  const client = new ApolloClient({
    cache: new InMemoryCache(),
    link: ApolloLink.from([requestLogger, new MockLink(mocks)]),
    defaultOptions: {
      ...(fetchPolicy === undefined ? {} : { watchQuery: { fetchPolicy } }),
      ...(autoDisposeTimeoutMs === undefined
        ? {}
        : { react: { suspense: { autoDisposeTimeoutMs } } }),
    },
  });
  return { client, requests };
};

export const fetchPolicies: SuspenseQueryHookFetchPolicy[] = [
  "cache-first",
  "network-only",
  "no-cache",
  "cache-and-network",
];

export const spyOnWatchQuery = (client: ApolloClient<unknown>) => {
  const watchQuery = jest.spyOn(client, "watchQuery");
  return (query: DocumentNode) =>
    watchQuery.mock.calls.filter(([options]) => options.query === query).length;
};

export * from "./mocks";
