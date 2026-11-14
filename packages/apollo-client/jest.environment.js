import JSDOMEnvironment from "jest-environment-jsdom";

const nodeGlobals = [
  "fetch",
  "Request",
  "Response",
  "Headers",
  "ReadableStream",
  "TextDecoder",
  "TextEncoder",
  "structuredClone",
];

export default class JSDOMWithFetchEnvironment extends JSDOMEnvironment {
  constructor(config, context) {
    super(config, context);
    for (const name of nodeGlobals) this.global[name] = globalThis[name];
  }
}
