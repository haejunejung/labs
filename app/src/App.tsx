import { useSyncExternalStore, type ComponentType } from "react";

import { QueryErrorResetBoundaryPage } from "./pages/QueryErrorResetBoundary";

const pages: { path: string; title: string; Page: ComponentType }[] = [
  {
    path: "query-error-reset-boundary",
    title: "QueryErrorResetBoundary",
    Page: QueryErrorResetBoundaryPage,
  },
];

const subscribeToHash = (onChange: () => void) => {
  window.addEventListener("hashchange", onChange);
  return () => window.removeEventListener("hashchange", onChange);
};

const getPath = () => window.location.hash.replace(/^#\/?/, "");

export function App() {
  const path = useSyncExternalStore(subscribeToHash, getPath);
  const current = pages.find((page) => page.path === path);

  return (
    <main>
      <nav>
        <a href="#/">labs</a>
        {pages.map((page) => (
          <a
            key={page.path}
            href={`#/${page.path}`}
            aria-current={page === current ? "page" : undefined}
          >
            {page.title}
          </a>
        ))}
      </nav>
      {current ? (
        <current.Page />
      ) : (
        <ul>
          {pages.map((page) => (
            <li key={page.path}>
              <a href={`#/${page.path}`}>{page.title}</a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
