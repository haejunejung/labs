import { ApolloProvider } from "@apollo/client";
import { describe, expect, it } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense } from "react";

import {
  AUTHOR_QUERY,
  BOOK_QUERY,
  createTestClient,
  fetchPolicies,
  mockAuthor,
  mockBook,
  mockGraphQLError,
  spyOnWatchQuery,
} from "../__test-utils__";
import { ErrorBoundary } from "./ErrorBoundary";
import { QueryErrorResetBoundary } from "./QueryErrorResetBoundary";
import { useSuspenseQuery } from "./useSuspenseQuery";

const Book = ({ id }: { id: string }) => {
  const { data } = useSuspenseQuery(BOOK_QUERY, { variables: { id } });
  return <p>{data.book?.title}</p>;
};

const Author = ({ id }: { id: string }) => {
  const { data } = useSuspenseQuery(AUTHOR_QUERY, { variables: { id } });
  return <p>{data.author?.name}</p>;
};

const ErrorBoundaryFallbackRender = ({
  resetErrorBoundary,
}: {
  resetErrorBoundary: VoidFunction;
}) => {
  return (
    <>
      <p>error</p>
      <button onClick={resetErrorBoundary}>reset</button>
    </>
  );
};

const SuspenseFallbackRender = <p>loading</p>;

const fallbackRenderWithLabel =
  (label: string) =>
  ({ resetErrorBoundary }: { resetErrorBoundary: VoidFunction }) => (
    <>
      <p>{label} error</p>
      <button onClick={resetErrorBoundary}>{label} reset</button>
    </>
  );

describe.each(fetchPolicies)("QueryErrorResetBoundary (fetchPolicy: %s)", (fetchPolicy) => {
  const createClient = (
    mocks: Parameters<typeof createTestClient>[0],
    options: Parameters<typeof createTestClient>[1] = {},
  ) => createTestClient(mocks, { ...options, fetchPolicy });

  describe("without QueryErrorResetBoundary", () => {
    it("does not request BOOK_QUERY again within autoDisposeTimeoutMs when the ErrorBoundary is reset", async () => {
      const { client, requests } = createClient(
        [mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }), mockBook("1", { delay: 20 })],
        { autoDisposeTimeoutMs: 30_000 },
      );

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <ErrorBoundary fallbackRender={ErrorBoundaryFallbackRender}>
              <Suspense fallback={SuspenseFallbackRender}>
                <Book id="1" />
              </Suspense>
            </ErrorBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect(requests).toEqual(["Book"]);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "reset" }));
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect(screen.queryByText("The Pragmatic Programmer")).not.toBeInTheDocument();
      expect(requests).toEqual(["Book"]);
    });

    it("requests BOOK_QUERY again only after autoDisposeTimeoutMs has elapsed", async () => {
      const autoDisposeTimeoutMs = 50;
      const { client, requests } = createClient(
        [mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }), mockBook("1", { delay: 20 })],
        { autoDisposeTimeoutMs },
      );

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <ErrorBoundary fallbackRender={ErrorBoundaryFallbackRender}>
              <Suspense fallback={SuspenseFallbackRender}>
                <Book id="1" />
              </Suspense>
            </ErrorBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect(requests).toEqual(["Book"]);

      await act(() => new Promise((resolve) => setTimeout(resolve, autoDisposeTimeoutMs * 2)));

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "reset" }));
      });

      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(requests).toEqual(["Book", "Book"]);
    });
  });

  describe("with QueryErrorResetBoundary", () => {
    it("requests BOOK_QUERY again immediately after reset", async () => {
      const { client, requests } = createClient([
        mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }),
        mockBook("1", { delay: 20 }),
      ]);

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={ErrorBoundaryFallbackRender}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Book id="1" />
                  </Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect(requests).toEqual(["Book"]);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "reset" }));
      });

      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(requests).toEqual(["Book", "Book"]);
    });

    it("requests BOOK_QUERY again on every reset until it succeeds", async () => {
      const { client, requests } = createClient([
        mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }),
        mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }),
        mockBook("1", { delay: 20 }),
      ]);

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={ErrorBoundaryFallbackRender}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Book id="1" />
                  </Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect(requests).toEqual(["Book"]);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "reset" }));
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect(requests).toEqual(["Book", "Book"]);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "reset" }));
      });

      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(screen.queryByText("error")).not.toBeInTheDocument();
      expect(requests).toEqual(["Book", "Book", "Book"]);
    });

    it("recovers sibling Suspense boundaries together after reset", async () => {
      const { client, requests } = createClient([
        mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }),
        mockGraphQLError(AUTHOR_QUERY, { id: "1" }, { delay: 20 }),
        mockBook("1", { delay: 20 }),
        mockAuthor("1", { delay: 20 }),
      ]);

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={ErrorBoundaryFallbackRender}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Book id="1" />
                  </Suspense>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Author id="1" />
                  </Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("error")).toBeInTheDocument();
      expect([...requests].sort()).toEqual(["Author", "Book"]);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "reset" }));
      });

      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(await screen.findByText("Andrew Hunt")).toBeInTheDocument();
      expect(screen.queryByText("error")).not.toBeInTheDocument();
      expect([...requests].sort()).toEqual(["Author", "Author", "Book", "Book"]);
    });
  });

  describe("with multiple QueryErrorResetBoundary", () => {
    it("does not affect queries under a sibling QueryErrorResetBoundary on reset", async () => {
      const { client, requests } = createClient([
        mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }),
        mockAuthor("1", { delay: 20 }),
        mockBook("1", { delay: 20 }),
      ]);
      const countWatchQuery = spyOnWatchQuery(client);

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={fallbackRenderWithLabel("book")}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Book id="1" />
                  </Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={fallbackRenderWithLabel("author")}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Author id="1" />
                  </Suspense>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("book error")).toBeInTheDocument();
      expect(await screen.findByText("Andrew Hunt")).toBeInTheDocument();
      expect(countWatchQuery(AUTHOR_QUERY)).toBe(1);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "book reset" }));
      });

      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(screen.getByText("Andrew Hunt")).toBeInTheDocument();
      expect(countWatchQuery(AUTHOR_QUERY)).toBe(1);
      expect([...requests].sort()).toEqual(["Author", "Book", "Book"]);
    });

    it("does not affect queries under the outer QueryErrorResetBoundary when the inner one is reset", async () => {
      const { client, requests } = createClient([
        mockAuthor("1", { delay: 20 }),
        mockGraphQLError(BOOK_QUERY, { id: "1" }, { delay: 20 }),
        mockBook("1", { delay: 20 }),
      ]);
      const countWatchQuery = spyOnWatchQuery(client);

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={fallbackRenderWithLabel("outer")}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Author id="1" />
                  </Suspense>
                  <QueryErrorResetBoundary>
                    {({ reset: resetInner }) => (
                      <ErrorBoundary
                        onReset={resetInner}
                        fallbackRender={fallbackRenderWithLabel("inner")}
                      >
                        <Suspense fallback={SuspenseFallbackRender}>
                          <Book id="1" />
                        </Suspense>
                      </ErrorBoundary>
                    )}
                  </QueryErrorResetBoundary>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("inner error")).toBeInTheDocument();
      expect(await screen.findByText("Andrew Hunt")).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "inner reset" }));
      });

      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(screen.getByText("Andrew Hunt")).toBeInTheDocument();
      expect(countWatchQuery(AUTHOR_QUERY)).toBe(1);
      expect([...requests].sort()).toEqual(["Author", "Book", "Book"]);
    });

    it("propagates the outer reset to queries under the inner QueryErrorResetBoundary", async () => {
      const { client } = createClient([
        mockGraphQLError(AUTHOR_QUERY, { id: "1" }, { delay: 20 }),
        mockBook("1", { delay: 20 }),
        mockAuthor("1", { delay: 20 }),
        mockBook("1", { delay: 20 }),
      ]);
      const countWatchQuery = spyOnWatchQuery(client);

      await act(async () => {
        render(
          <ApolloProvider client={client}>
            <QueryErrorResetBoundary>
              {({ reset }) => (
                <ErrorBoundary onReset={reset} fallbackRender={fallbackRenderWithLabel("outer")}>
                  <Suspense fallback={SuspenseFallbackRender}>
                    <Author id="1" />
                  </Suspense>
                  <QueryErrorResetBoundary>
                    {({ reset: resetInner }) => (
                      <ErrorBoundary
                        onReset={resetInner}
                        fallbackRender={fallbackRenderWithLabel("inner")}
                      >
                        <Suspense fallback={SuspenseFallbackRender}>
                          <Book id="1" />
                        </Suspense>
                      </ErrorBoundary>
                    )}
                  </QueryErrorResetBoundary>
                </ErrorBoundary>
              )}
            </QueryErrorResetBoundary>
          </ApolloProvider>,
        );
      });

      expect(await screen.findByText("outer error")).toBeInTheDocument();
      await act(() => new Promise((resolve) => setTimeout(resolve, 50)));
      expect(countWatchQuery(BOOK_QUERY)).toBe(1);

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "outer reset" }));
      });

      expect(await screen.findByText("Andrew Hunt")).toBeInTheDocument();
      expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
      expect(countWatchQuery(BOOK_QUERY)).toBe(2);
    });
  });
});
