import { createServer } from "node:http";
import type { IncomingMessage } from "node:http";
import { setTimeout as sleep } from "node:timers/promises";
import { createYoga } from "graphql-yoga";
import { createMockSchema } from "./schema.ts";

function header(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Transport failures are driven by request headers so a client can pick one per operation:
 * - `x-mock-delay: <ms>` waits before answering.
 * - `x-mock-error: server` answers HTTP 500 with a plain-text body.
 * - `x-mock-error: network` drops the connection without a response.
 * GraphQL errors and partial data come from the schema's `fail` field.
 */
export function createMockServer() {
  const yoga = createYoga({ schema: createMockSchema() });

  return createServer(async (req, res) => {
    await sleep(Number(header(req, "x-mock-delay") ?? 0));

    switch (header(req, "x-mock-error")) {
      case "network":
        req.socket.destroy();
        return;
      case "server":
        res.writeHead(500, { "content-type": "text/plain" }).end("Internal Server Error");
        return;
      default:
        await yoga(req, res);
    }
  });
}
