/** @type {import('jest').Config} */
export default {
  passWithNoTests: true,
  testEnvironment: "<rootDir>/jest.environment.js",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  transform: {
    "^.+\\.(t|j)sx?$": ["@swc/jest", { jsc: { transform: { react: { runtime: "automatic" } } } }],
  },
};
