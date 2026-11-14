import {
  gql,
  type OperationVariables,
  type TypedDocumentNode,
  type Unmasked,
} from "@apollo/client";
import type { MockedResponse } from "@apollo/client/testing";

type Book = { __typename: "Book"; id: string; title: string; author: string };
type Author = { __typename: "Author"; id: string; name: string; bio: string };

const books: ReadonlyArray<Book> = [
  { __typename: "Book", id: "1", title: "The Pragmatic Programmer", author: "Andrew Hunt" },
  { __typename: "Book", id: "2", title: "Refactoring", author: "Martin Fowler" },
  { __typename: "Book", id: "3", title: "Domain-Driven Design", author: "Eric Evans" },
];

const authors: ReadonlyArray<Author> = [
  {
    __typename: "Author",
    id: "1",
    name: "Andrew Hunt",
    bio: "Co-author of The Pragmatic Programmer.",
  },
  { __typename: "Author", id: "2", name: "Martin Fowler", bio: "Chief Scientist at Thoughtworks." },
  { __typename: "Author", id: "3", name: "Eric Evans", bio: "Founder of Domain Language." },
];

export const BOOK_QUERY: TypedDocumentNode<{ book: Book | null }, { id: string }> = gql`
  query Book($id: ID!) {
    book(id: $id) {
      id
      title
      author
    }
  }
`;

export const AUTHOR_QUERY: TypedDocumentNode<{ author: Author | null }, { id: string }> = gql`
  query Author($id: ID!) {
    author(id: $id) {
      id
      name
      bio
    }
  }
`;

type MockOptions = { delay?: number };

const withDelay = (delay: number | undefined) => (delay === undefined ? {} : { delay });

const mockResult = <TData, TVariables extends OperationVariables>(
  query: TypedDocumentNode<TData, TVariables>,
  variables: TVariables,
  data: Unmasked<TData>,
  { delay }: MockOptions = {},
): MockedResponse<TData, TVariables> => ({
  request: { query, variables },
  result: { data },
  ...withDelay(delay),
});

export const mockGraphQLError = <TData, TVariables extends OperationVariables>(
  query: TypedDocumentNode<TData, TVariables>,
  variables: TVariables,
  { delay }: MockOptions = {},
): MockedResponse<TData, TVariables> => ({
  request: { query, variables },
  result: { errors: [{ message: "Mock resolver error" }] },
  ...withDelay(delay),
});

export const mockBook = (id: string, options?: MockOptions) =>
  mockResult(BOOK_QUERY, { id }, { book: books.find((book) => book.id === id) ?? null }, options);

export const mockAuthor = (id: string, options?: MockOptions) =>
  mockResult(
    AUTHOR_QUERY,
    { id },
    { author: authors.find((author) => author.id === id) ?? null },
    options,
  );
