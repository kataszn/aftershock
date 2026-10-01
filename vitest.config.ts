import { defineConfig } from 'vitest/config';

// Single workspace-aware config. Each package/app is a "project" so tests stay
// colocated next to the code they exercise (`*.test.ts`), while one config
// governs globs and shared settings for the whole workspace.
//
// Run everything from the root:  pnpm test
// Run one package:               pnpm --filter @repo/worker test
export default defineConfig({
  test: {
    projects: ['packages/*', 'apps/*'],
  },
});