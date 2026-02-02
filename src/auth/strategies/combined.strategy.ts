import { Strategy } from 'passport-custom';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import * as jwt from 'jsonwebtoken';
import { AuthService } from '../auth.service';
import { AdminAuthService } from '../../admin-auth/admin-auth.service';

@Injectable()
export class CombinedStrategy extends PassportStrategy(Strategy, 'combined') {
  private readonly logger = new Logger(CombinedStrategy.name);

  constructor(
    private readonly authService: AuthService,
    private readonly adminAuthService: AdminAuthService,
  ) {
    super();
  }

  async validate(req: Request): Promise<any> {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // Pas de token, on laisse une autre stratégie (si elle existe) ou le garde échouer.
      // Pour être plus strict, on pourrait lancer une erreur ici.
      throw new UnauthorizedException(
        'Missing or invalid authorization header.',
      );
    }
    const token = authHeader.substring(7);

    const payload = jwt.decode(token);
    if (!payload || typeof payload === 'string') {
      throw new UnauthorizedException('Invalid token format.');
    }

    // --- Logique d'aiguillage ---
    if (
      payload.iss &&
      payload.iss.startsWith('https://securetoken.google.com')
    ) {
      this.logger.debug('Detected Firebase token, delegating to AuthService.');
      // Votre méthode pour valider le token Firebase et retourner un utilisateur.
      return this.authService.validateAndLinkUser(token);
    } else {
      this.logger.debug(
        'Detected Admin token, delegating to AdminAuthService.',
      );
      // Vérification de type pour s'assurer que le payload a la forme attendue pour un token admin.
      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        !Array.isArray(payload.roles)
      ) {
        throw new UnauthorizedException(
          'Token admin invalide : le payload est malformé.',
        );
      }

      // Maintenant que la forme est validée, on peut le passer au service en toute sécurité.
      // Le 'as' ici est sûr car nous venons de vérifier les types.
      return this.adminAuthService.validateJwtPayload(
        payload as { sub: string; email: string; roles: string[] },
      );
    }
  }
}
