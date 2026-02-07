import { faker } from '@faker-js/faker';
import { TestBed, Mocked } from '@suites/unit';
import { ClsService as ClsServiceInNest } from 'nestjs-cls';
import { ClsStorage, AuthUser } from './cls.interface';
import { ClsService } from './cls.service';

describe('ClsService', () => {
  let clsService: ClsService;
  let nestClsService: Mocked<ClsServiceInNest<ClsStorage>>;

  beforeAll(async () => {
    const { unit, unitRef } = await TestBed.solitary(ClsService).compile();

    clsService = unit;
    nestClsService = unitRef.get(ClsServiceInNest);
  });

  beforeEach(() => jest.clearAllMocks());

  describe('store', () => {
    it('should return the CLS store from nestjs-cls', () => {
      const testId = faker.string.uuid();
      const store: ClsStorage = { requestId: testId };
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      expect(clsService.store).toBe(store);
      expect(nestClsService.get).toHaveBeenCalled();
    });
  });

  describe('runWith', () => {
    it('should delegate to nestjs-cls runWith', () => {
      const testId = faker.string.uuid();
      const store: ClsStorage = { requestId: testId };
      const callback = jest.fn().mockReturnValue('result');
      nestClsService.runWith.mockReturnValue('result');

      const result = clsService.runWith(store, callback);

      expect(nestClsService.runWith).toHaveBeenCalledWith(store, callback);
      expect(result).toBe('result');
    });
  });

  describe('requestId', () => {
    it('should get requestId from store', () => {
      const requestId = faker.string.uuid();
      const store: ClsStorage = { requestId };
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      expect(clsService.requestId).toBe(requestId);
    });

    it('should return undefined when store is undefined', () => {
      nestClsService.get.mockReturnValue(
        undefined as unknown as ClsStorage & Record<string, unknown>,
      );

      expect(clsService.requestId).toBeUndefined();
    });

    it('should set requestId on store when store exists', () => {
      const newRequestId = faker.string.uuid();
      const store: ClsStorage = {};
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      clsService.requestId = newRequestId;

      expect(store.requestId).toBe(newRequestId);
    });

    it('should not throw when setting requestId and store is undefined', () => {
      const newRequestId = faker.string.uuid();
      nestClsService.get.mockReturnValue(
        undefined as unknown as ClsStorage & Record<string, unknown>,
      );

      expect(() => {
        clsService.requestId = newRequestId;
      }).not.toThrow();
    });
  });

  describe('controllerCtx', () => {
    it('should get controllerCtx from store', () => {
      const controllerName = `${faker.word.noun()}Controller`;
      const store: ClsStorage = { controllerCtx: controllerName };
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      expect(clsService.controllerCtx).toBe(controllerName);
    });

    it('should set controllerCtx on store', () => {
      const controllerName = `${faker.word.noun()}Controller`;
      const store: ClsStorage = {};
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      clsService.controllerCtx = controllerName;

      expect(store.controllerCtx).toBe(controllerName);
    });
  });

  describe('methodCtx', () => {
    it('should get methodCtx from store', () => {
      const methodName = faker.lorem.word();
      const store: ClsStorage = { methodCtx: methodName };
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      expect(clsService.methodCtx).toBe(methodName);
    });

    it('should set methodCtx on store', () => {
      const methodName = faker.lorem.word();
      const store: ClsStorage = {};
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      clsService.methodCtx = methodName;

      expect(store.methodCtx).toBe(methodName);
    });
  });

  describe('user', () => {
    const mockUser: AuthUser = {
      userId: faker.string.uuid(),
      email: faker.internet.email(),
      roles: [faker.lorem.word()],
      tokenHash: faker.string.alphanumeric(32),
      tokenExp: faker.number.int({ min: 1000000, max: 9999999999 }),
    };

    it('should get user from store', () => {
      const store: ClsStorage = { user: mockUser };
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      expect(clsService.user).toBe(mockUser);
    });

    it('should set user on store', () => {
      const store: ClsStorage = {};
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      clsService.user = mockUser;

      expect(store.user).toBe(mockUser);
    });

    it('should set user to undefined on store', () => {
      const store: ClsStorage = { user: mockUser };
      nestClsService.get.mockReturnValue(store as ClsStorage & Record<string, unknown>);

      clsService.user = undefined;

      expect(store.user).toBeUndefined();
    });
  });
});
