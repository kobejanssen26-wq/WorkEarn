// All date/time logic is exercised in the primary market's time zone so that
// DST, midnight-crossing and weekday tests are deterministic on any machine.
process.env.TZ = 'Europe/Brussels';

/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['<rootDir>/tests/**/*.test.ts', '<rootDir>/tests/**/*.test.tsx'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
  cacheDirectory: '<rootDir>/.jest-cache',
};
