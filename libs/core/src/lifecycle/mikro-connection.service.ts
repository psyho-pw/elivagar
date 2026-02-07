import { MikroORM } from '@mikro-orm/core';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { ConnectionNames } from './lifecycle.constant';
import { ConnectionState, IManagedConnection } from './lifecycle.interface';
import { LoggerService } from '../logger/logger.service';

@Injectable()
export class MikroConnectionService implements IManagedConnection, OnModuleInit, OnModuleDestroy {
  private _state: ConnectionState = ConnectionState.DISCONNECTED;

  readonly connectionName = ConnectionNames.DATABASE;

  constructor(
    private readonly orm: MikroORM,
    private readonly connectionRegistry: ConnectionRegistryService,
    private readonly loggerService: LoggerService,
  ) {
    this.connectionRegistry.register(this, {
      required: true,
    });
  }

  get state(): ConnectionState {
    return this._state;
  }

  async onModuleInit(): Promise<void> {
    await this.connect();
  }

  async onModuleDestroy(): Promise<void> {
    if (this._state !== ConnectionState.DISCONNECTED) {
      await this.disconnect();
    }
  }

  async connect(): Promise<void> {
    if (this._state === ConnectionState.CONNECTED || this._state === ConnectionState.CONNECTING) {
      return;
    }

    this._state = ConnectionState.CONNECTING;
    this.loggerService.info(this.connect.name, 'Connecting to database...');

    try {
      // MikroORM connects automatically, but we verify the connection
      const isConnected = await this.orm.isConnected();

      if (!isConnected) {
        await this.orm.connect();
      }

      // Verify with a simple query
      await this.orm.em.getConnection().execute('SELECT 1');

      this._state = ConnectionState.CONNECTED;
      this.connectionRegistry.emitStateChange(this.connectionName, this._state);
      this.loggerService.info(this.connect.name, '✅ connected to database');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry.emitStateChange(this.connectionName, this._state);
      this.loggerService.error(this.connect.name, error, 'Failed to connect to database');
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === ConnectionState.DISCONNECTED) {
      return;
    }

    this._state = ConnectionState.DISCONNECTING;
    this.loggerService.info(this.disconnect.name, 'Disconnecting from database...');

    try {
      await this.orm.close();
      this._state = ConnectionState.DISCONNECTED;
      this.connectionRegistry.emitStateChange(this.connectionName, this._state);
      this.loggerService.info(this.disconnect.name, 'Disconnected from database');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry.emitStateChange(this.connectionName, this._state);
      throw error;
    }
  }

  async isHealthy(): Promise<boolean> {
    if (this._state !== ConnectionState.CONNECTED) {
      return false;
    }

    try {
      await this.orm.em.getConnection().execute('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }
}
