import { Injectable } from '@nestjs/common';
import { ClsService as ClsServiceInNest } from 'nestjs-cls';
import { ClsStorage, IClsService } from './cls.interface';

@Injectable()
export class ClsService implements IClsService {
  constructor(private readonly clsService: ClsServiceInNest<ClsStorage>) {}

  public get store(): ClsStorage {
    return this.clsService.get();
  }

  public runWith<T>(store: ClsStorage, callback: () => T): T {
    return this.clsService.runWith(store, callback);
  }

  public get requestId(): ClsStorage['requestId'] {
    return this.store?.requestId;
  }

  public set requestId(requestId: string) {
    if (this.store) this.store.requestId = requestId;
  }
}
