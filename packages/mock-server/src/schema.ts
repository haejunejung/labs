import { GraphQLError } from "graphql";
import { createSchema } from "graphql-yoga";

type Book = { id: string; title: string; author: string };

const seed: Book[] = [
  { id: "1", title: "The Pragmatic Programmer", author: "Andrew Hunt" },
  { id: "2", title: "Refactoring", author: "Martin Fowler" },
  { id: "3", title: "Domain-Driven Design", author: "Eric Evans" },
];

export function createMockSchema() {
  const books = structuredClone(seed);

  return createSchema({
    typeDefs: /* GraphQL */ `
      type Book {
        id: ID!
        title: String!
        author: String!
      }

      type Query {
        books: [Book!]!
        book(id: ID!): Book
        "Always resolves to a GraphQL error. Select it next to other fields to get partial data."
        fail(message: String = "Mock resolver error"): String
      }

      type Mutation {
        addBook(title: String!, author: String!): Book!
      }
    `,
    resolvers: {
      Query: {
        books: () => books,
        book: (_: unknown, { id }: { id: string }) => books.find((book) => book.id === id) ?? null,
        fail: (_: unknown, { message }: { message: string }) => {
          throw new GraphQLError(message);
        },
      },
      Mutation: {
        addBook: (_: unknown, input: Omit<Book, "id">) => {
          const book = { id: String(books.length + 1), ...input };
          books.push(book);
          return book;
        },
      },
    },
  });
}
