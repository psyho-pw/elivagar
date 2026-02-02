import { MikroORM } from '@mikro-orm/core';
import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConnectionRegistryService } from './connection-registry.service';
import { ConnectionNames } from './lifecycle.constant';
import { ConnectionState, IManagedConnection } from './lifecycle.interface';

@Injectable()
export class MikroConnectionService implements IManagedConnection, OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MikroConnectionService.name);
  private _state: ConnectionState = ConnectionState.DISCONNECTED;

  readonly connectionName = ConnectionNames.DATABASE;

  constructor(
    private readonly orm: MikroORM,
    private readonly connectionRegistry: ConnectionRegistryService,
  ) {
    // Register with lifecycle manager (lowest priority - shuts down last)
    this.connectionRegistry.register(this, {
      shutdownPriority: 0,
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
    // Shutdown is handled by ShutdownManager via disconnect()
    // This hook is just for safety if module is destroyed without shutdown signal
  }

  async connect(): Promise<void> {
    if (this._state === ConnectionState.CONNECTED || this._state === ConnectionState.CONNECTING) {
      return;
    }

    this._state = ConnectionState.CONNECTING;
    this.logger.log('Connecting to database...');

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
      this.logger.log('✅ connected to database');
    } catch (error) {
      this._state = ConnectionState.ERROR;
      this.connectionRegistry.emitStateChange(this.connectionName, this._state);
      this.logger.error('Failed to connect to database', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this._state === ConnectionState.DISCONNECTED) {
      return;
    }

    this._state = ConnectionState.DISCONNECTING;
    this.logger.log('Disconnecting from database...');

    try {
      await this.orm.close();
      this._state = ConnectionState.DISCONNECTED;
      this.connectionRegistry.emitStateChange(this.connectionName, this._state);
      this.logger.log('Disconnected from database');
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
