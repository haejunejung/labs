import {
  ApolloProvider,
  gql,
  type SuspenseQueryHookFetchPolicy,
  type TypedDocumentNode,
} from "@apollo/client";
import {
  ErrorBoundary,
  QueryErrorResetBoundary,
  useSuspenseQuery,
} from "@labs/apollo-client/query-error-reset-boundary";
import { Suspense, useState, useSyncExternalStore, type ReactNode } from "react";

import { createDemoClient, createDemoStore, type DemoStore } from "./demoClient";

const BOOK_QUERY: TypedDocumentNode<
  { book: { id: string; title: string } | null },
  { id: string }
> = gql`
  query Book($id: ID!) {
    book(id: $id) {
      id
      title
    }
  }
`;

const fetchPolicies: SuspenseQueryHookFetchPolicy[] = [
  "cache-first",
  "network-only",
  "no-cache",
  "cache-and-network",
];

const Book = ({ id }: { id: string }) => {
  const { data } = useSuspenseQuery(BOOK_QUERY, { variables: { id } });
  return (
    <p className="ok">
      book {id}: {data.book?.title}
    </p>
  );
};

const BookSection = ({ id }: { id: string }) => (
  <Suspense fallback={<p className="loading">book {id}: loading…</p>}>
    <Book id={id} />
  </Suspense>
);

const fallbackRender =
  (label: string) =>
  ({ resetErrorBoundary }: { resetErrorBoundary: VoidFunction }) => (
    <div className="error">
      <span>{label} error</span>
      <button onClick={resetErrorBoundary}>Retry {label}</button>
    </div>
  );

type Scenario = {
  title: string;
  expectation: string;
  bookIds: string[];
  initialFailures: Record<string, number>;
  render: () => ReactNode;
};

const scenarios: Scenario[] = [
  {
    title: "Without QueryErrorResetBoundary",
    expectation:
      "Retry sends no request and the same error shows again. A new request goes out only once 30 seconds (autoDisposeTimeoutMs) have passed since the error.",
    bookIds: ["1"],
    initialFailures: { "1": 1 },
    render: () => (
      <ErrorBoundary fallbackRender={fallbackRender("book 1")}>
        <BookSection id="1" />
      </ErrorBoundary>
    ),
  },
  {
    title: "With QueryErrorResetBoundary",
    expectation:
      "Retry sends a new request right away. With more failures queued, each press sends one more request.",
    bookIds: ["1"],
    initialFailures: { "1": 1 },
    render: () => (
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onReset={reset} fallbackRender={fallbackRender("book 1")}>
            <BookSection id="1" />
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    ),
  },
  {
    title: "Sibling Suspense boundaries recover together",
    expectation: "Both queries under one ErrorBoundary fail. A single retry requests both again.",
    bookIds: ["1", "2"],
    initialFailures: { "1": 1, "2": 1 },
    render: () => (
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onReset={reset} fallbackRender={fallbackRender("books")}>
            <BookSection id="1" />
            <BookSection id="2" />
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    ),
  },
  {
    title: "Sibling QueryErrorResetBoundary isolation",
    expectation: "Only book 1 fails. Retrying book 1 does not request book 2 again.",
    bookIds: ["1", "2"],
    initialFailures: { "1": 1 },
    render: () => (
      <>
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary onReset={reset} fallbackRender={fallbackRender("book 1")}>
              <BookSection id="1" />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
        <QueryErrorResetBoundary>
          {({ reset }) => (
            <ErrorBoundary onReset={reset} fallbackRender={fallbackRender("book 2")}>
              <BookSection id="2" />
            </ErrorBoundary>
          )}
        </QueryErrorResetBoundary>
      </>
    ),
  },
  {
    title: "Nested: the outer reset propagates inward",
    expectation:
      "Book 2 in the outer boundary fails, so the outer fallback shows. Retrying the outer boundary also gives the inner book 1 a new key. With the network-only family of policies, book 1 is requested again too.",
    bookIds: ["2", "1"],
    initialFailures: { "2": 1 },
    render: () => (
      <QueryErrorResetBoundary>
        {({ reset }) => (
          <ErrorBoundary onReset={reset} fallbackRender={fallbackRender("outer")}>
            <BookSection id="2" />
            <div className="nested">
              <QueryErrorResetBoundary>
                {({ reset: resetInner }) => (
                  <ErrorBoundary onReset={resetInner} fallbackRender={fallbackRender("inner")}>
                    <BookSection id="1" />
                  </ErrorBoundary>
                )}
              </QueryErrorResetBoundary>
            </div>
          </ErrorBoundary>
        )}
      </QueryErrorResetBoundary>
    ),
  },
];

const RequestLog = ({ store, bookIds }: { store: DemoStore; bookIds: string[] }) => {
  const { failuresLeft, log } = useSyncExternalStore(store.subscribe, store.getState);
  return (
    <div className="controls">
      <div>
        {bookIds.map((id) => (
          <button key={id} onClick={() => store.addFailure(id)}>
            Fail next book {id} request +1 ({failuresLeft[id] ?? 0} left)
          </button>
        ))}
      </div>
      <ol className="log">
        {log.map((entry) => (
          <li key={entry.seq} className={entry.failed ? "failed" : undefined}>
            #{entry.seq} book {entry.bookId} {entry.failed ? "failed" : "succeeded"}
          </li>
        ))}
      </ol>
    </div>
  );
};

const ScenarioRun = ({
  scenario,
  fetchPolicy,
}: {
  scenario: Scenario;
  fetchPolicy: SuspenseQueryHookFetchPolicy;
}) => {
  const [{ store, client }] = useState(() => {
    const demoStore = createDemoStore();
    for (const [id, count] of Object.entries(scenario.initialFailures)) {
      for (let i = 0; i < count; i++) demoStore.addFailure(id);
    }
    return { store: demoStore, client: createDemoClient(demoStore, fetchPolicy) };
  });

  return (
    <div className="run">
      <ApolloProvider client={client}>
        <div className="stage">{scenario.render()}</div>
      </ApolloProvider>
      <RequestLog store={store} bookIds={scenario.bookIds} />
    </div>
  );
};

const ScenarioCard = ({
  scenario,
  fetchPolicy,
}: {
  scenario: Scenario;
  fetchPolicy: SuspenseQueryHookFetchPolicy;
}) => {
  const [runId, setRunId] = useState(0);
  return (
    <section className="card">
      <header>
        <h2>{scenario.title}</h2>
        <button onClick={() => setRunId((prev) => prev + 1)}>Restart</button>
      </header>
      <p className="expectation">{scenario.expectation}</p>
      <ScenarioRun key={`${fetchPolicy}-${runId}`} scenario={scenario} fetchPolicy={fetchPolicy} />
    </section>
  );
};

export function QueryErrorResetBoundaryPage() {
  const [fetchPolicy, setFetchPolicy] = useState<SuspenseQueryHookFetchPolicy>("cache-first");

  return (
    <>
      <h1>QueryErrorResetBoundary</h1>
      <label>
        fetchPolicy{" "}
        <select
          value={fetchPolicy}
          onChange={(event) => setFetchPolicy(event.target.value as SuspenseQueryHookFetchPolicy)}
        >
          {fetchPolicies.map((policy) => (
            <option key={policy}>{policy}</option>
          ))}
        </select>
      </label>
      {scenarios.map((scenario) => (
        <ScenarioCard key={scenario.title} scenario={scenario} fetchPolicy={fetchPolicy} />
      ))}
    </>
  );
}
