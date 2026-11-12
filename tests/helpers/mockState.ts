import type { Db } from '@/db/types';

/** Shared, per-test state read by the module mocks in tests/setup/ui-mocks.tsx. */
export const mockState: {
  db: Db | null;
  /** CSV text captured by the mocked export service. */
  lastCsv: string | null;
  params: Record<string, string>;
  router: { push: jest.Mock; back: jest.Mock; replace: jest.Mock; navigate: jest.Mock; canGoBack: () => boolean };
} = {
  db: null,
  lastCsv: null,
  params: {},
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn(), navigate: jest.fn(), canGoBack: () => true },
};
