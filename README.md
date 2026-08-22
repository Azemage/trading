# Ledger Capital — Plateforme de gestion NAV

> **Ce système gère des fonds de tiers.** Toute modification touchant au calcul du NAV, aux frais, ou aux mouvements de fonds doit être testée avec des cas limites (dépôt et retrait simultanés, gate atteint, position ouverte au moment du calcul) avant déploiement. Le statut légal de cette activité (enregistrement CNBV / Asesor en Inversiones ou équivalent) doit être clarifié avant toute mise en production avec de vrais clients externes.

## État de ce dépôt

Fondations backend + frontend de la v1, construites à partir du prototype
`plateforme-prototype.jsx` et du brief technique. Priorité donnée à la
correction du modèle de données et de la logique métier (NAV, gate, frais,
mouvements en attente) avant les fonctionnalités avancées.

**Saisie des trades** : manuelle uniquement dans cette phase (le gestionnaire
trade depuis l'application mobile Worldcoin et reporte le résultat). Aucune
intégration API d'exchange n'est câblée pour l'instant — voir la section
sécurité ci-dessous, à respecter strictement le jour où une clé API sera
ajoutée.

## Stack

- **Next.js 16** (App Router, React 19, TypeScript) — frontend + backend dans le même projet.
- **PostgreSQL + Prisma** — cohérence transactionnelle sur les parts/AUM (verrouillage de lignes `FOR UPDATE` sur les mouvements concurrents).
- **Auth.js (NextAuth v5)**, provider Credentials, mots de passe hashés avec `bcryptjs`.
- **Vitest** pour les tests (logique pure + tests d'intégration contre une vraie base Postgres).

## Démarrage local

```bash
# 1. Base de données
createdb ledger_capital   # ou via psql, cf. .env pour les identifiants attendus
cp .env.example .env      # puis ajuster DATABASE_URL / AUTH_SECRET

# 2. Dépendances + schéma
npm install
npm run db:migrate

# 3. Compte gestionnaire de départ (les comptes gestionnaire ne sont jamais
#    créés via une route publique — uniquement via ce script ou un accès direct DB)
npm run db:seed

# 4. Lancer
npm run dev
```

Les clients s'inscrivent eux-mêmes via `/register`. Les gestionnaires sont
provisionnés hors ligne (`db:seed`, ou création manuelle en base) — il n'existe
volontairement aucun formulaire public pour créer un compte gestionnaire.

### Tests

```bash
npm test
```

Les tests d'intégration (`movements.integration.test.ts`) tournent contre une
vraie base Postgres (`ledger_capital_test`, voir `.env.test`) et couvrent
explicitement les cas limites exigés ci-dessus : dépôt/retrait simultanés,
gate mensuel atteint, rejet d'un retrait avec restitution des parts, NAV figé
à la demande (anti-arbitrage).

## Sécurité — clés API d'exchange (à respecter dès la première intégration)

Ce projet n'a **pas encore** de connexion à une API d'exchange (trades saisis
manuellement). Le jour où l'automatisation sera ajoutée :

- **Permissions de la clé API = lecture + trading UNIQUEMENT. Jamais "withdrawal" / "retrait".** Même en cas de compromission totale du serveur, un attaquant ne doit pouvoir ni retirer, ni virer les fonds vers un wallet externe.
- **Stockage** : jamais en dur dans le code, jamais côté client. Variable d'environnement serveur, idéalement secrets manager (Vault, AWS Secrets Manager, ou au minimum les secrets chiffrés de la plateforme d'hébergement).
- **Whitelist IP** sur la clé API si l'exchange le permet, limitée à l'IP du serveur backend.
- **Rotation de clé documentée** : procédure claire pour régénérer sans interrompre le service.

## Modèle de données

Voir `prisma/schema.prisma`. Points notables par rapport au prototype :

- **NAV figé à la demande, pas à l'approbation** (`navAtRequest` sur `pending_movements`) : un dépôt ou un retrait est converti en parts au NAV du moment de la demande, jamais recalculé au moment où le gestionnaire agit. Évite qu'un client arbitre le délai de traitement (12–24h) à son avantage.
- **Délai anti-arbitrage** (`PENDING_MOVEMENT_DELAY_HOURS`, 24h par défaut) : un mouvement en attente n'est actionnable par le gestionnaire qu'une fois ce délai écoulé (`eligibleAt`), appliqué côté serveur sur chaque route d'approbation/envoi.
- **Performance fee au high-water mark** : contrairement au prototype (qui facture 30% de tout gain, y compris une simple remontée après une perte), la v1 ne facture que les gains **au-dessus du plus haut NAV historique** (`pool_state.highWaterMark`). Évite de facturer deux fois une même reprise. Si l'accord de gestion réel ne prévoit pas de HWM, ajuster `src/lib/fees.ts`.
- **Gate mensuel en FIFO simple** (v1, comme le prototype) : le surplus au-delà du budget de gate est différé, sans file d'attente automatique pour le cycle suivant — le client doit re-solliciter. Le gate pro-rata est prévu pour la v2 (cf. brief).
- **`audit_log` en écriture seule** : aucune fonction `update`/`delete` sur cette table dans le code applicatif (`src/lib/audit.ts`).

## Ce qui reste à faire avant une v1 utilisable en production

1. **Notifications email** (confirmation de dépôt, retrait exécuté, alerte gestionnaire sur nouvelle demande) — non implémentées.
2. **2FA** sur les comptes (recommandé vu la nature financière) — non implémentée dans cette phase de fondations.
3. **Intégration API exchange en lecture seule** (cf. section sécurité) pour synchroniser automatiquement les trades — actuellement saisie manuelle uniquement.
4. **Job planifié** (cron) pour le recalcul périodique du NAV et le traitement de la file des mouvements arrivés à échéance — actuellement déclenché uniquement par action du gestionnaire.
5. **KYC réel** : le champ `kycStatus` existe en base mais aucun flux de vérification n'est branché.
6. Clarifier le statut légal de l'activité avant tout client externe réel (cf. rappel en tête de ce fichier).

## Ce qui peut attendre une v2 (déjà écarté du scope de cette phase)

Gate pro-rata au lieu de FIFO, plusieurs classes de parts (standard/premium),
rapports fiscaux automatisés, API publique pour clients institutionnels.
