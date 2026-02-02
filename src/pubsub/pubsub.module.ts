import { Global, Module } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';
import { EventEmitter } from 'events';

// On définit un "token" d'injection. C'est une bonne pratique pour éviter
// d'injecter des classes directement, ce qui offre plus de flexibilité.
export const PUB_SUB = 'PUB_SUB';

@Global() // Rend ce module et ses exports disponibles dans toute l'application
@Module({
  providers: [
    {
      provide: PUB_SUB,
      useFactory: () => {
        const eventEmitter = new EventEmitter();
        eventEmitter.setMaxListeners(50); // Increase limit for many subscribers (e.g. LIKES_UPDATED)
        return new PubSub({ eventEmitter });
      },
    },
  ],
  exports: [PUB_SUB], // On exporte le provider pour qu'il soit injectable ailleurs
})
export class PubSubModule {}
