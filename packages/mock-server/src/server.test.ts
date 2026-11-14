import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { createMockServer } from "./server.ts";

const server = createMockServer();
let url = "";

before(async () => {
  await new Promise<void>((resolve) => server.listen(0, resolve));
  url = `http://localhost:${(server.address() as AddressInfo).port}/graphql`;
});
after(() => server.close());

function post(query: string, headers: Record<string, string> = {}) {
  return fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify({ query }),
  });
}

describe("mock server", () => {
  it("answers queries", async () => {
    const res = await post('{ book(id: "2") { title } }');
    assert.deepEqual(await res.json(), { data: { book: { title: "Refactoring" } } });
  });

  it("persists mutations for the life of the server", async () => {
    await post('mutation { addBook(title: "SICP", author: "Abelson") { id } }');
    const res = await post("{ books { title } }");
    const { data } = (await res.json()) as { data: { books: { title: string }[] } };
    assert.ok(data.books.some((book) => book.title === "SICP"));
  });

  it("returns partial data with a GraphQL error from `fail`", async () => {
    const res = await post('{ book(id: "1") { id } fail(message: "boom") }');
    const body = (await res.json()) as { data: unknown; errors: { message: string }[] };
    assert.equal(res.status, 200);
    assert.deepEqual(body.data, { book: { id: "1" }, fail: null });
    assert.equal(body.errors[0]?.message, "boom");
  });

  it("answers HTTP 500 for x-mock-error: server", async () => {
    const res = await post("{ books { id } }", { "x-mock-error": "server" });
    assert.equal(res.status, 500);
    assert.equal(await res.text(), "Internal Server Error");
  });

  it("drops the connection for x-mock-error: network", async () => {
    await assert.rejects(post("{ books { id } }", { "x-mock-error": "network" }), TypeError);
  });

  it("waits for x-mock-delay", async () => {
    const start = performance.now();
    await post("{ books { id } }", { "x-mock-delay": "200" });
    assert.ok(performance.now() - start >= 190);
  });
});
