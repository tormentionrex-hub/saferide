module.exports = {
  testEnvironment: 'node',
  coverageDirectory: 'coverage',
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/tests/**',
    '!src/scripts/**',
    '!node_modules/**',
  ],
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.tests.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/src/tests/setup.js'],
  testTimeout: 30000, // 30 seconds for async operations
  verbose: true,
};
