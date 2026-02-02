import { IApp, IConfigsService } from '@app/core/configs/configs.interface';
import { LoggerService } from '@app/core/logger/logger.service';
import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { VersioningOptions } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';

/**
 * Bootstrap 프로세스의 결과
 */
export interface BootstrapResult {
  app: NestExpressApplication;
  appConfig: IApp;
  loggerService: LoggerService;
}

/**
 * gRPC 마이크로서비스 설정
 */
export interface GrpcConfig {
  enabled: boolean;
  /** gRPC 서비스 이름 (기본값: AppConfig.serviceName) */
  serviceName?: string;
  /** Proto 버전 (기본값: 'v1') */
  version?: string;
}

/**
 * 미들웨어 설정
 */
export interface MiddlewareConfig {
  /** Helmet 활성화 (기본값: 배포 환경에서 true) */
  helmet?: boolean;
  /** CORS 설정 (기본값: true) */
  cors?: boolean | CorsOptions;
  /** 글로벌 API prefix (예: 'api') */
  globalPrefix?: string;
}

/**
 * API 버저닝 설정
 */
export interface VersioningConfig {
  enabled: boolean;
  options?: VersioningOptions;
}

/**
 * Bootstrap 옵션
 */
export interface BootstrapOptions {
  /** 시작 시 로그 버퍼링 활성화 (기본값: true) */
  bufferLogs?: boolean;
  /** 셧다운 훅 활성화 (기본값: true) */
  enableShutdownHooks?: boolean;
}

/**
 * 전체 Bootstrap 설정
 */
export interface BootstrapConfig {
  options?: BootstrapOptions;
  middleware?: MiddlewareConfig;
  versioning?: VersioningConfig;
  grpc?: GrpcConfig;
}
