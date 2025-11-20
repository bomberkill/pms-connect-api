import { createParamDecorator, ExecutionContext, Type } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import * as DataLoader from 'dataloader';

/**
 * A parameter decorator to inject a DataLoader instance.
 * It retrieves the DataloaderService from the GraphQL context and uses it
 * to get the requested DataLoader instance.
 */
export const Dataloader = createParamDecorator(
  <T extends DataLoader<any, any>>(
    loaderType: Type<T>,
    context: ExecutionContext,
  ): T => {
    const ctx = GqlExecutionContext.create(context).getContext();
    return ctx.dataloaderService.getLoader(loaderType);
  },
);