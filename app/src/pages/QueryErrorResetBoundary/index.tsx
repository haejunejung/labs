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
      <button onClick={resetErrorBoundary}>{label} 다시 시도</button>
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
    title: "QueryErrorResetBoundary 없음",
    expectation:
      "다시 시도를 눌러도 요청이 나가지 않고 같은 에러가 다시 뜬다. 에러 후 30초(autoDisposeTimeoutMs)가 지나야 다시 요청한다.",
    bookIds: ["1"],
    initialFailures: { "1": 1 },
    render: () => (
      <ErrorBoundary fallbackRender={fallbackRender("book 1")}>
        <BookSection id="1" />
      </ErrorBoundary>
    ),
  },
  {
    title: "QueryErrorResetBoundary 있음",
    expectation:
      "다시 시도를 누르면 즉시 다시 요청한다. 실패를 더 추가하면 누를 때마다 한 번씩 다시 요청한다.",
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
    title: "형제 Suspense 함께 복구",
    expectation:
      "한 ErrorBoundary 아래 두 쿼리가 모두 실패한다. 다시 시도 한 번으로 둘 다 다시 요청한다.",
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
    title: "형제 QueryErrorResetBoundary 격리",
    expectation: "book 1만 실패한다. book 1을 다시 시도해도 book 2는 다시 요청하지 않는다.",
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
    title: "중첩: 바깥 reset이 안쪽으로 전파",
    expectation:
      "바깥의 book 2가 실패해 바깥 fallback이 뜬다. 바깥을 다시 시도하면 안쪽 book 1도 새 키를 받는다. network-only 계열에서는 book 1도 다시 요청한다.",
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
            book {id} 다음 요청 실패 +1 (남음 {failuresLeft[id] ?? 0})
          </button>
        ))}
      </div>
      <ol className="log">
        {log.map((entry) => (
          <li key={entry.seq} className={entry.failed ? "failed" : undefined}>
            #{entry.seq} book {entry.bookId} {entry.failed ? "실패" : "성공"}
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
        <button onClick={() => setRunId((prev) => prev + 1)}>처음부터</button>
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
