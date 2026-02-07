import { Metadata, ServerUnaryCall } from '@grpc/grpc-js';

export interface GrpcModuleOptions {
  name: string;
  version?: string;
  url?: string;
}

export interface GrpcDto<T, V> {
  data: T;
  metadata: Metadata;
  call: ServerUnaryCall<T, V>;
}
