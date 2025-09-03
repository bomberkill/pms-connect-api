import {
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { AuthGuard } from '@nestjs/passport';

/**
 * Un garde d'authentification personnalisé qui combine plusieurs stratégies ('firebase', 'admin-jwt').
 * Il est conçu pour fonctionner avec GraphQL en extrayant correctement la requête
 * et en désactivant explicitement les sessions pour éviter l'erreur `req.logIn`.
 */
@Injectable()
export class ApiAuthGuard extends AuthGuard(['firebase', 'admin-jwt']) {
  // Étape 1: Rendre le garde compatible avec GraphQL
  getRequest(context: ExecutionContext) {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req;
  }

  // Étape 2: Gérer le résultat et désactiver les sessions
  handleRequest(err, user, info, context, status) {
    // Cette méthode est appelée après qu'une des stratégies a réussi ou que toutes ont échoué.
    // En la surchargeant, nous court-circuitons le comportement par défaut qui appelle `req.logIn()`.

    // Si une erreur s'est produite (par ex. un token invalide), `info` contiendra souvent l'erreur.
    // Le problème est que si la première stratégie (`firebase`) échoue avec une erreur,
    // la chaîne s'arrête et la stratégie `admin-jwt` n'est jamais essayée.
    const errorMessage = info instanceof Error ? info.message : 'Authentication Failed';

    if (err || !user) {
      throw err || new UnauthorizedException(errorMessage);
    }
    return user;
  }
}
