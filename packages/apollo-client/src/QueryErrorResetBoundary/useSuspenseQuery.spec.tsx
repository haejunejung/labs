import { ApolloProvider, skipToken } from "@apollo/client";
import { describe, expect, it } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { Suspense, useState } from "react";

import {
  BOOK_QUERY,
  createTestClient,
  fetchPolicies,
  mockBook,
  spyOnWatchQuery,
} from "../__test-utils__";
import { ErrorBoundary } from "./ErrorBoundary";
import { QueryErrorResetBoundary } from "./QueryErrorResetBoundary";
import { useSuspenseQuery } from "./useSuspenseQuery";

const Book = ({ id }: { id: string }) => {
  const { data } = useSuspenseQuery(BOOK_QUERY, { variables: { id } });
  return <p>{data.book?.title}</p>;
};

const BookWithQueryKey = ({ id, queryKey }: { id: string; queryKey: string[] }) => {
  const { data } = useSuspenseQuery(BOOK_QUERY, { variables: { id }, queryKey });
  return <p>{data.book?.title}</p>;
};

const SkippedBook = () => {
  const { data } = useSuspenseQuery(BOOK_QUERY, skipToken);
  return <p>{data === undefined ? "skipped" : data.book?.title}</p>;
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

describe.each(fetchPolicies)("useSuspenseQuery (fetchPolicy: %s)", (fetchPolicy) => {
  const createClient = (
    mocks: Parameters<typeof createTestClient>[0],
    options: Parameters<typeof createTestClient>[1] = {},
  ) => createTestClient(mocks, { ...options, fetchPolicy });

  it("renders the query data when the request succeeds", async () => {
    const { client } = createClient([mockBook("1", { delay: 20 })]);

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

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(screen.queryByText("error")).not.toBeInTheDocument();
  });

  it("does not request BOOK_QUERY again when the tree re-renders after success", async () => {
    const { client, requests } = createClient([mockBook("1", { delay: 20 })]);
    const countWatchQuery = spyOnWatchQuery(client);

    const App = () => {
      const [count, setCount] = useState(0);
      return (
        <ApolloProvider client={client}>
          <button onClick={() => setCount((prev) => prev + 1)}>rerender</button>
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary onReset={reset} fallbackRender={ErrorBoundaryFallbackRender}>
                <Suspense fallback={SuspenseFallbackRender}>
                  <p>render {count}</p>
                  <Book id="1" />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </ApolloProvider>
      );
    };

    await act(async () => {
      render(<App />);
    });

    expect(await screen.findByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(requests).toEqual(["Book"]);
    expect(countWatchQuery(BOOK_QUERY)).toBe(1);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "rerender" }));
    });

    expect(screen.getByText("render 1")).toBeInTheDocument();
    expect(screen.getByText("The Pragmatic Programmer")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(requests).toEqual(["Book"]);
    expect(countWatchQuery(BOOK_QUERY)).toBe(1);
  });

  it("keeps the queryKey passed by the caller", async () => {
    const { client } = createClient([mockBook("1", { delay: 20 }), mockBook("1", { delay: 20 })]);
    const countWatchQuery = spyOnWatchQuery(client);

    await act(async () => {
      render(
        <ApolloProvider client={client}>
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary onReset={reset} fallbackRender={ErrorBoundaryFallbackRender}>
                <Suspense fallback={SuspenseFallbackRender}>
                  <BookWithQueryKey id="1" queryKey={["a"]} />
                  <BookWithQueryKey id="1" queryKey={["b"]} />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </ApolloProvider>,
      );
    });

    expect(await screen.findAllByText("The Pragmatic Programmer")).toHaveLength(2);
    expect(countWatchQuery(BOOK_QUERY)).toBe(2);
  });

  it("does not request or suspend when skipToken is passed", async () => {
    const { client, requests } = createClient([]);

    await act(async () => {
      render(
        <ApolloProvider client={client}>
          <QueryErrorResetBoundary>
            {({ reset }) => (
              <ErrorBoundary onReset={reset} fallbackRender={ErrorBoundaryFallbackRender}>
                <Suspense fallback={SuspenseFallbackRender}>
                  <SkippedBook />
                </Suspense>
              </ErrorBoundary>
            )}
          </QueryErrorResetBoundary>
        </ApolloProvider>,
      );
    });

    expect(screen.getByText("skipped")).toBeInTheDocument();
    expect(screen.queryByText("loading")).not.toBeInTheDocument();
    expect(screen.queryByText("error")).not.toBeInTheDocument();
    expect(requests).toEqual([]);
  });
});
