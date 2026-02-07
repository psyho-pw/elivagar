import { HttpStatus } from '@nestjs/common';

export interface IApiResponsePayload<T = undefined, S extends number = HttpStatus.OK> {
  statusCode: S;
  message?: string;
  data: T;
}

export class ApiResponse<T = undefined, S extends number = HttpStatus.OK> {
  statusCode: S;
  message: string;
  data: T;

  constructor(payload: IApiResponsePayload<T, S>) {
    this.statusCode = payload.statusCode;
    this.message = payload.message ?? 'Success';
    this.data = payload.data;
  }
}
