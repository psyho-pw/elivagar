export function TransformDto() {
  return function (
    _target: unknown,
    _propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;

    descriptor.value = function (...args: unknown[]): unknown {
      const [data, metadata, call] = args;
      const params = { data, metadata, call };
      return originalMethod.call(this, params);
    };

    return descriptor;
  };
}
