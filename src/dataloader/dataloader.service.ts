import { Injectable, Scope, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import * as DataLoader from 'dataloader';

/**
 * This service is request-scoped. A new instance is created for each incoming request,
 * and it is destroyed when the request is completed.
 * It acts as a registry for all DataLoader instances for the current request.
 */
@Injectable({ scope: Scope.REQUEST })
export class DataloaderService {
  private readonly loaders = new Map<Type<any>, DataLoader<any, any>>();

  constructor(private readonly moduleRef: ModuleRef) {}

  /**
   * Register a DataLoader instance for the given type for this request.
   */
  setLoader<T extends DataLoader<any, any>>(
    loaderType: Type<T>,
    instance: T,
  ): void {
    this.loaders.set(loaderType, instance);
  }

  /**
   * Gets a DataLoader instance for the given type previously registered for this request.
   * Throws if not pre-registered in the GraphQL context factory.
   */
  getLoader<T extends DataLoader<any, any>>(loaderType: Type<T>): T {
    const loader = this.loaders.get(loaderType);
    if (!loader) {
      throw new Error(`DataLoader not registered for ${loaderType?.name}`);
    }
    return loader as T;
  }
}
