import { ConfigsServiceKey } from '@app/core/configs/configs.constant';
import { IApp, IConfigsService } from '@app/core/configs/configs.interface';
import { Env } from '@app/core/constants/app.constant';
import { ReadinessGateService } from '@app/core/lifecycle/readiness-gate.service';
import { LoggerService } from '@app/core/logger/logger.service';
import { GrpcService } from '@app/grpc/grpc/grpc.service';
import { Type, VersioningType } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { GrpcOptions } from '@nestjs/microservices';
import { NestExpressApplication } from '@nestjs/platform-express';
import helmet from 'helmet';
import { WINSTON_MODULE_NEST_PROVIDER } from 'nest-winston';
import {
  BootstrapConfig,
  BootstrapOptions,
  BootstrapResult,
  GrpcConfig,
  MiddlewareConfig,
  ReadinessConfig,
  VersioningConfig,
} from './bootstrap.interface';

/**
 * NestJS 애플리케이션 Bootstrap을 위한 추상 기본 클래스.
 * Template Method 패턴을 사용하여 일관된 서비스 시작 순서를 보장
 */
export abstract class AbstractMain {
  protected app!: NestExpressApplication;
  protected configService!: IConfigsService;
  protected loggerService!: LoggerService;
  protected appConfig!: IApp;

  /**
   * 필수: NestFactory.create()에 전달할 루트 모듈 클래스 반환
   */
  protected abstract getModule(): Type<unknown>;

  /**
   * 선택: Bootstrap 설정을 오버라이드하여 커스터마이징
   * 기본값은 최소 설정을 반환
   */
  protected getBootstrapConfig(): BootstrapConfig {
    return {};
  }

  /**
   * 메인 진입점 - 애플리케이션 생성 및 시작
   */
  public static async run<T extends AbstractMain>(this: new () => T): Promise<BootstrapResult> {
    const instance = new this();
    return instance.bootstrap();
  }

  /**
   * Bootstrap 프로세스를 조율하는 템플릿 메서드
   */
  protected async bootstrap(): Promise<BootstrapResult> {
    const config = this.getBootstrapConfig();

    // NestJS 애플리케이션 생성
    await this.createApplication(config.options);

    // 핵심 서비스 획득
    await this.resolveServices();

    // 시작 정보 로깅
    this.logStartupInfo();

    // 미들웨어 설정
    await this.configureMiddleware(config.middleware);

    // API 버저닝 설정
    this.configureVersioning(config.versioning);

    // Winston 로거 설정
    this.setupLogger();

    // gRPC 설정
    await this.configureGrpc(config.grpc);

    // 애플리케이션 초기화 (OnModuleInit 훅 실행)
    await this.app.init();

    // Readiness 체크 - 모든 연결이 준비될 때까지 대기
    await this.waitForReadiness(config.readiness);

    // 리스닝 전 훅
    await this.onBeforeListen();

    // 마이크로서비스 및 HTTP 서버 시작
    await this.startServers(config.grpc);

    // 리스닝 후 훅
    await this.onAfterListen();

    // HMR 설정
    this.configureHMR();

    return {
      app: this.app,
      appConfig: this.appConfig,
      loggerService: this.loggerService,
    };
  }

  /**
   * NestJS 애플리케이션 인스턴스 생성
   */
  protected async createApplication(options?: BootstrapOptions): Promise<void> {
    this.app = await NestFactory.create<NestExpressApplication>(this.getModule(), {
      bufferLogs: options?.bufferLogs ?? true,
    });

    if (options?.enableShutdownHooks !== false) {
      this.app.enableShutdownHooks();
    }
  }

  /**
   * 애플리케이션 컨텍스트에서 핵심 서비스 획득
   */
  protected async resolveServices(): Promise<void> {
    this.configService = this.app.get<IConfigsService>(ConfigsServiceKey);
    this.appConfig = this.configService.AppConfig;

    // LoggerService는 TRANSIENT 스코프이므로 resolve() 사용
    this.loggerService = await this.app.resolve(LoggerService);
    this.loggerService.setContext(this.constructor.name);
  }

  /**
   * 매핑된 환경 변수 포함 시작 정보 로깅
   */
  protected logStartupInfo(): void {
    this.loggerService.info('bootstrap', this.configService.All, 'mapped env variables');
  }

  /**
   * 환경 및 옵션에 따라 미들웨어 설정
   */
  protected async configureMiddleware(config?: MiddlewareConfig): Promise<void> {
    const isDeployedEnv = this.isDeployedEnvironment();

    // Trust proxy (로드 밸런서를 위해 중요)
    if (isDeployedEnv) {
      this.app.set('trust proxy', true);
    }

    // Helmet 보안 미들웨어 (기본값: 배포 환경에서 활성화)
    if (config?.helmet !== false && isDeployedEnv) {
      this.app.use(helmet());
    }

    // CORS 설정
    if (config?.cors !== false) {
      if (typeof config?.cors === 'object') {
        this.app.enableCors(config.cors);
      } else {
        this.app.enableCors(this.getDefaultCorsOptions());
      }
    }

    // 글로벌 prefix
    if (config?.globalPrefix) {
      this.app.setGlobalPrefix(config.globalPrefix);
    }
  }

  /**
   * 기본 CORS 옵션 - 커스텀 설정이 필요하면 오버라이드
   */
  protected getDefaultCorsOptions(): object {
    return {
      origin: this.appConfig.clientURI || true,
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
    };
  }

  /**
   * API 버저닝 설정
   */
  protected configureVersioning(config?: VersioningConfig): void {
    if (!config?.enabled) return;

    if (config.options) {
      this.app.enableVersioning(config.options);
    } else {
      this.app.enableVersioning({
        type: VersioningType.URI,
        defaultVersion: '1',
      });
    }
  }

  /**
   * 애플리케이션 로거로 Winston 설정
   */
  protected setupLogger(): void {
    this.app.useLogger(this.app.get(WINSTON_MODULE_NEST_PROVIDER));
  }

  /**
   * gRPC 마이크로서비스 설정
   */
  protected async configureGrpc(config?: GrpcConfig): Promise<void> {
    if (!config?.enabled) return;

    try {
      const grpcService = this.app.get<GrpcService>(GrpcService);
      const grpcOptions: GrpcOptions = grpcService.getOptions({
        name: config.serviceName ?? this.appConfig.serviceName,
        version: config.version ?? 'v1',
      });

      this.app.connectMicroservice<GrpcOptions>(grpcOptions);
    } catch (error) {
      this.loggerService.warn(
        'configureGrpc',
        error,
        'GrpcService not available - skipping gRPC configuration',
      );
    }
  }

  /**
   * 모든 마이크로서비스 및 HTTP 서버 시작
   */
  protected async startServers(grpcConfig?: GrpcConfig): Promise<void> {
    // gRPC가 활성화된 경우 마이크로서비스 먼저 시작
    if (grpcConfig?.enabled) {
      await this.app.startAllMicroservices().catch((e) => {
        this.loggerService.error('startServers', e, 'failed to start microservices');
        throw e;
      });
    }

    // HTTP 서버 시작
    await this.app.listen(this.appConfig.port).catch((e) => {
      this.loggerService.error('startServers', e, 'failed to listen on HTTP port');
      throw e;
    });
  }

  /**
   * 개발 환경에서 HMR (Hot Module Replacement) 설정
   */
  protected configureHMR(): void {
    const hotModule = (module as NodeModule & { hot?: HotModule }).hot;
    if (hotModule) {
      hotModule.accept();
      hotModule.dispose(() => this.app.close());
    }
  }

  /**
   * 배포 환경(비개발) 여부 확인
   */
  protected isDeployedEnvironment(): boolean {
    const env = this.appConfig.env;
    return env !== Env.development && env !== Env.test;
  }

  /**
   * 모든 연결이 준비될 때까지 대기 (Readiness Gate)
   */
  protected async waitForReadiness(config?: ReadinessConfig): Promise<void> {
    if (config?.enabled === false) {
      this.loggerService.debug('waitForReadiness', 'Readiness check disabled');
      return;
    }

    try {
      const readinessGate = this.app.get(ReadinessGateService);
      await readinessGate.waitForReady(config?.timeout);
    } catch (error) {
      // ReadinessGateService가 없으면 건너뜀 (LifecycleModule이 import되지 않은 경우)
      const isProviderNotFound =
        error instanceof Error &&
        (error.name === 'UnknownElementException' ||
          error.message?.includes('Nest could not find'));
      if (isProviderNotFound) {
        this.loggerService.debug(
          'waitForReadiness',
          'LifecycleModule not imported, skipping readiness check',
        );
        return;
      }
      this.loggerService.error('waitForReadiness', error, 'Readiness check failed');
      throw error;
    }
  }

  /**
   * HOOK: 서버 시작 전 호출. 커스텀 설정을 위해 오버라이드
   */
  protected async onBeforeListen(): Promise<void> {
    // 서브클래스에서 필요시 오버라이드
  }

  /**
   * HOOK: 서버 시작 후 호출. 기본적으로 시작 로그 출력
   */
  protected async onAfterListen(): Promise<void> {
    const grpcConfig = this.getBootstrapConfig().grpc;
    const messages = [
      `🚀 [${this.appConfig.serviceName}][${this.appConfig.env}] Server listening on port ${this.appConfig.port}`,
    ];

    if (grpcConfig?.enabled) {
      messages.push(
        `🚀 [${this.appConfig.serviceName}][${this.appConfig.env}] gRPC Server listening on port ${this.appConfig.grpcPort}`,
      );
    }

    this.loggerService.info(this.constructor.name, messages);
  }
}

/**
 * TypeScript용 HMR 모듈 인터페이스
 */
interface HotModule {
  accept(): void;
  dispose(callback: () => void): void;
}
