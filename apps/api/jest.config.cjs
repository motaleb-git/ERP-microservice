/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ["js", "json", "ts"],
  rootDir: "src",
  testRegex: ".*\\.spec\\.ts$",
  transform: {
    "^.+\\.ts$": "ts-jest",
  },
  moduleNameMapper: {
    "^@erp/shared$": "<rootDir>/../../../packages/shared/src/index.ts",
    "^@erp/config$": "<rootDir>/../../../packages/config/src/index.ts",
    "^@erp/types$": "<rootDir>/../../../packages/types/src/index.ts",
  },
  collectCoverageFrom: ["**/*.ts", "!main.ts", "!worker.ts"],
  coverageDirectory: "../coverage",
  testEnvironment: "node",
};
