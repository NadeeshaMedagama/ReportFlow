/** End-to-end tests: boot the real Nest app against DATABASE_URL (or TEST_DATABASE_URL). */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '..',
  testRegex: 'test/.*\\.e2e-spec\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  testTimeout: 60000,
  setupFiles: ['<rootDir>/test/setup-env.ts'],
};
