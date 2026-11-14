import { createMockServer } from "./server.ts";

const port = Number(process.env["PORT"] ?? 4000);

createMockServer().listen(port, () => {
  console.log(`Mock GraphQL server on http://localhost:${port}/graphql`);
});
