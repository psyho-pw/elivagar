// Load actual @mikro-orm/core by filesystem path to bypass Jest moduleNameMapper
const path = require('path');
const corePath = path.resolve(__dirname, '../../node_modules/@mikro-orm/core');
const actual = require(corePath) as Record<string, unknown>;

module.exports = {
  ...actual,
  Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) => descriptor,
};
