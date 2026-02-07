import { ClsStore } from 'nestjs-cls';

export type AuthUser = {
  userId: string;
  email: string;
  roles: string[];
  tokenHash: string;
  tokenExp: number;
};

export type ClsStorage = {
  requestId?: string;
  controllerCtx?: string;
  methodCtx?: string;
  user?: AuthUser;
};

export interface IClsService {
  store: ClsStorage;
  runWith<T>(store: ClsStore, callback: () => T): T;
  requestId?: string;
  controllerCtx?: string;
  methodCtx?: string;
  user?: AuthUser;
}
