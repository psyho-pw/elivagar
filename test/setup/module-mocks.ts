import { MOCK_UUID_V4, MOCK_UUID_V7 } from '../mocks/uuid.mock';

jest.mock('uuid', () => ({
  v4: (): string => MOCK_UUID_V4,
  v7: (): string => MOCK_UUID_V7,
}));

jest.mock('change-case', () => ({
  camelCase: (str: string): string => str.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase()),
  pascalCase: (str: string): string => {
    const camel = str.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  },
  snakeCase: (str: string): string =>
    str
      .replace(/([a-z])([A-Z])/g, '$1_$2')
      .replace(/[-\s]/g, '_')
      .toLowerCase(),
  kebabCase: (str: string): string =>
    str
      .replace(/([a-z])([A-Z])/g, '$1-$2')
      .replace(/[\s_]/g, '-')
      .toLowerCase(),
}));

jest.mock('@mikro-orm/core', () => {
  const actual = jest.requireActual<typeof import('@mikro-orm/core')>('@mikro-orm/core');
  return {
    ...actual,
    Transactional: () => (_target: unknown, _key: string, descriptor: PropertyDescriptor) =>
      descriptor,
  };
});
