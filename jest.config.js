/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/', '<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/core(|/.*)$': '<rootDir>/libs/core/src/$1',
    '^@app/grpc(|/.*)$': '<rootDir>/libs/grpc/src/$1',
    '^@app/mikro(|/.*)$': '<rootDir>/libs/mikro/src/$1',
  },
};
