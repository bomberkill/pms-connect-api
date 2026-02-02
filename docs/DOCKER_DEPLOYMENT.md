# 🐳 Docker Deployment Guide

## 📋 Fichiers Docker

Vous avez maintenant 2 configurations :

1. **`docker-compose.yml`** - Développement local (avec MongoDB local)
2. **`docker-compose.prod.yml`** - Production (utilise MongoDB Atlas)

---

## 🔧 Cache In-Memory : Explication

### Qu'est-ce que c'est ?

**Cache in-memory** = Cache stocké dans la RAM de votre serveur Node.js

```
┌─────────────────────────────────┐
│   Votre API (Node.js)           │
│                                 │
│   RAM (Mémoire)                 │
│   ┌─────────────────────┐       │
│   │ Cache In-Memory     │       │
│   │                     │       │
│   │ user:123 → {...}    │       │
│   │ feed:0:20 → [...]   │       │
│   └─────────────────────┘       │
│                                 │
│   ⚡ Rapide (1-5ms)             │
│   ⚠️  Perdu au redémarrage      │
│   ⚠️  Un seul serveur           │
└─────────────────────────────────┘
```

**Actuellement, vous utilisez le cache in-memory** car Redis n'est pas installé.

### Avantages

- ✅ Gratuit (inclus dans Node.js)
- ✅ Aucune configuration
- ✅ Rapide
- ✅ Parfait pour < 100 users

### Inconvénients

- ❌ Perdu au redémarrage
- ❌ Ne fonctionne pas avec plusieurs serveurs
- ❌ Limité par la RAM du serveur

---

## 🚀 Utilisation

### Développement Local

```bash
# Démarrer avec MongoDB local
docker-compose up -d

# Voir les logs
docker-compose logs -f api

# Arrêter
docker-compose down
```

### Production (Render, DigitalOcean, etc.)

```bash
# Construire et démarrer
docker-compose -f docker-compose.prod.yml up -d

# Ou juste l'API (MongoDB Atlas dans .env)
docker build -t pms-api .
docker run -p 8000:8000 --env-file .env pms-api
```

---

## 🔴 Quand activer Redis ?

### Maintenant (20 users)
```yaml
# docker-compose.prod.yml
services:
  api:
    # ... configuration API
    # PAS de Redis
```

**Résultat :** Cache in-memory (gratuit, suffisant)

### Plus tard (100+ users)

```yaml
# docker-compose.prod.yml
services:
  api:
    depends_on:
      - redis  # ← Décommenter
    environment:
      - REDIS_HOST=redis  # ← Ajouter

  redis:  # ← Décommenter tout ce bloc
    image: redis:7-alpine
    ports:
      - "6379:6379"
    volumes:
      - redis-data:/data
```

**Résultat :** Cache Redis (partagé, persistant)

---

## 📊 Comparaison

| Aspect | Cache In-Memory | Redis |
|--------|-----------------|-------|
| **Coût** | Gratuit | $0-15/mois |
| **Vitesse** | 1-5ms | 1-5ms |
| **Persistance** | ❌ Perdu au redémarrage | ✅ Sauvegardé |
| **Multi-serveurs** | ❌ Un seul | ✅ Partagé |
| **Complexité** | Simple | Moyenne |
| **Recommandé pour** | < 100 users | 100+ users |

---

## 🎯 Votre situation actuelle

**Avec 20 utilisateurs :**
- ✅ Cache in-memory suffit largement
- ✅ Aucun coût supplémentaire
- ✅ Configuration déjà faite
- ✅ Prêt pour Redis quand nécessaire

**Quand activer Redis :**
- 📈 100+ utilisateurs actifs
- 🐌 Temps de réponse > 500ms
- 💻 Charge CPU > 70%
- 🚀 Déploiement multi-serveurs

---

## 💡 Commandes utiles

```bash
# Voir l'utilisation du cache (logs)
docker-compose logs -f api | grep -i cache

# Redémarrer l'API (cache perdu avec in-memory)
docker-compose restart api

# Vérifier la RAM utilisée
docker stats

# Nettoyer tout
docker-compose down -v
```

---

## 🔧 Variables d'environnement importantes

```bash
# .env
PORT=8000
MONGODB_URI=mongodb+srv://...  # MongoDB Atlas (production)

# Redis (optionnel - quand vous en aurez besoin)
REDIS_HOST=redis  # ou localhost
REDIS_PORT=6379
REDIS_PASSWORD=
```

---

## ✅ Résumé

1. **Actuellement** : Cache in-memory (gratuit, suffisant)
2. **Docker** : `docker-compose.prod.yml` prêt pour production
3. **Redis** : Commenté, facile à activer plus tard
4. **Coût** : $0 supplémentaire
5. **Performance** : Excellente pour 20 users

**Vous êtes prêt pour déployer ! 🚀**
