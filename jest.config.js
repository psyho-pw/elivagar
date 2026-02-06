/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', { compiler: 'ts-patch/compiler' }],
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: './coverage',
  testEnvironment: 'node',
  roots: ['<rootDir>/apps/', '<rootDir>/libs/'],
  moduleNameMapper: {
    '^@app/core(|/.*)$': '<rootDir>/libs/core/src/$1',
    '^@app/grpc(|/.*)$': '<rootDir>/libs/grpc/src/$1',
    '^@app/mikro(|/.*)$': '<rootDir>/libs/mikro/src/$1',
    '^@app/cache(|/.*)$': '<rootDir>/libs/cache/src/$1',
    '^@app/kafka(|/.*)$': '<rootDir>/libs/kafka/src/$1',
    '^@app/auth(|/.*)$': '<rootDir>/libs/auth/src/$1',
  },
};
