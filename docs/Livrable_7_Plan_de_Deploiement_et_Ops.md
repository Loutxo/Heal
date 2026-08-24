# Heal — Plan de Déploiement & Opérations

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)

> **v1.1 — Changelog :** renommage Harméal → Heal (domaines, emails, repos Supabase) ; ⚠️ vérifier la disponibilité de la marque "Heal" et des domaines avant réservation (nom générique anglais, cf. Product Brief §3) ; mots-clés ASO enrichis.

---

## 1. Environnements

### Structure des environnements

| Environnement | URL | Usage | Déclenchement |
|---|---|---|---|
| **Development** | localhost | Dev quotidien, tests unitaires | Manuel (développeur) |
| **Staging** | staging.heal.app | Tests QA, recette, E2E | Merge sur `main` |
| **Production** | heal.app | Utilisateurs réels | Tag de release (`vX.Y.Z`) |

### Isolation des environnements

```
Development :
  ├── Supabase local (CLI) — port 54321
  ├── Données fictives (seed de dev)
  ├── Claude API — clé dev (quota limité)
  └── Stripe — mode test

Staging :
  ├── Supabase projet "heal-staging" (Scaleway)
  ├── Données de test réalistes (seed QA)
  ├── Claude API — clé staging
  ├── Stripe — mode test
  └── RevenueCat — sandbox

Production :
  ├── Supabase projet "heal-prod" (Scaleway HDS)
  ├── Données utilisateurs réelles
  ├── Claude API — clé production
  ├── Stripe — mode live
  └── RevenueCat — production
```

---

## 2. Pipeline CI/CD

### Workflow GitHub Actions

```
┌─────────────────────────────────────────────────────────────┐
│  PUSH / PR vers une branche feature                         │
└──────────────────────────┬──────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│  JOB : pr-checks (sur chaque PR)                            │
│                                                              │
│  1. Checkout code                                            │
│  2. Install dependencies (npm ci)                            │
│  3. Lint (ESLint + Prettier --check)                         │
│  4. Type check (tsc --noEmit)                                │
│  5. Tests unitaires (jest --testPathPattern=unit)            │
│  6. Tests d'intégration (jest --testPathPattern=integration) │
│     └── Supabase local démarré automatiquement              │
│                                                              │
│  ✅ Tout vert → PR mergeable                                 │
│  ❌ Échec → PR bloquée, notification au développeur          │
└──────────────────────────┬──────────────────────────────────┘
                           ↓ (Merge sur main)
┌─────────────────────────────────────────────────────────────┐
│  JOB : deploy-staging                                        │
│                                                              │
│  1. Build Expo EAS (staging profile)                         │
│     ├── iOS Simulator Build                                  │
│     └── Android APK                                          │
│  2. Deploy migrations BDD → Supabase staging                 │
│  3. Deploy Edge Functions → Supabase staging                 │
│  4. Deploy web app → staging.heal.app                     │
│  5. Tests E2E (Detox + Playwright) sur staging               │
│  6. Notification : "Staging mis à jour — prêt pour QA"       │
└──────────────────────────┬──────────────────────────────────┘
                           ↓ (Validation QA + Tag release)
┌─────────────────────────────────────────────────────────────┐
│  JOB : deploy-production (déclenché par tag vX.Y.Z)          │
│                                                              │
│  1. Build Expo EAS (production profile)                      │
│     ├── iOS IPA (App Store)                                  │
│     └── Android AAB (Google Play)                            │
│  2. Deploy migrations BDD → Supabase production              │
│  3. Deploy Edge Functions → Supabase production              │
│  4. Deploy web app → heal.app                             │
│  5. Submit iOS → App Store Connect (TestFlight d'abord)      │
│  6. Submit Android → Google Play (internal track d'abord)    │
│  7. Smoke tests post-déploiement                             │
│  8. Notification : "Production déployée — v X.Y.Z"           │
└─────────────────────────────────────────────────────────────┘
```

### Fichier GitHub Actions principal (`.github/workflows/deploy.yml`)

```yaml
name: Heal CI/CD

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]
  push:
    tags: ['v*.*.*']

jobs:
  pr-checks:
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - name: Start Supabase local
        uses: supabase/setup-cli@v1
      - run: supabase start
      - run: npm run test:unit
      - run: npm run test:integration

  deploy-staging:
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: expo/expo-github-action@v8
        with: { expo-version: latest, token: ${{ secrets.EXPO_TOKEN }} }
      - run: npx supabase db push --project-ref ${{ secrets.STAGING_PROJECT_REF }}
      - run: npx supabase functions deploy --project-ref ${{ secrets.STAGING_PROJECT_REF }}
      - run: eas build --platform all --profile staging --non-interactive
      - run: npm run test:e2e

  deploy-production:
    if: startsWith(github.ref, 'refs/tags/v')
    runs-on: ubuntu-latest
    environment: production  # Requiert approbation manuelle
    steps:
      - uses: actions/checkout@v4
      - run: npx supabase db push --project-ref ${{ secrets.PROD_PROJECT_REF }}
      - run: npx supabase functions deploy --project-ref ${{ secrets.PROD_PROJECT_REF }}
      - run: eas build --platform all --profile production --non-interactive
      - run: eas submit --platform ios --latest
      - run: eas submit --platform android --latest
      - run: npm run test:smoke
```

---

## 3. Gestion des migrations de base de données

### Stratégie

```
migrations/
├── 20260511_001_initial_schema.sql         ← Schéma initial complet
├── 20260511_002_seed_regions.sql           ← Données régions
├── 20260511_003_seed_food_categories.sql   ← Données catégories
├── 20260515_001_add_notification_settings.sql  ← Évolution schema
└── ...
```

### Règles de migration

1. **Toujours en avant** — jamais de rollback automatique (trop risqué)
2. **Non destructif** — `ALTER TABLE ADD COLUMN` plutôt que `DROP COLUMN`
3. **Testé en staging** avant production — obligatoire
4. **Idempotent** — peut être rejoué sans erreur (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`)
5. **Migrations de données séparées** des migrations de schéma

---

## 4. Déploiement App Stores

### Apple App Store

#### Prérequis
- [ ] Compte Apple Developer actif (99 $/an)
- [ ] App ID créé dans Apple Developer Console
- [ ] Certificats de signature configurés dans EAS
- [ ] App créée dans App Store Connect

#### Processus de soumission
```
1. Build EAS Production (IPA signé)
2. Upload via eas submit → App Store Connect
3. TestFlight (beta interne) — validation 1–2 jours
4. Soumission App Review — délai moyen 24–48h
5. Release manuelle après approbation (ne pas auto-release)
```

#### Exigences Apple spécifiques pour Heal
- [ ] **Apple Login** obligatoire (car d'autres logins sociaux présents)
- [ ] **Politique de confidentialité** accessible via URL publique
- [ ] **Déclaration nutritions** : app classée "Food & Drink"
- [ ] **Privacy Nutrition Labels** remplis dans App Store Connect :
  - Données de santé collectées (déclaration obligatoire)
  - Email, prénom (liés à l'identité)
  - Usage analytics (anonymisé)
- [ ] **In-App Purchase** déclarés : abonnement mensuel + annuel

---

### Google Play Store

#### Prérequis
- [ ] Compte Google Play Console (25 $ paiement unique)
- [ ] App créée dans Play Console
- [ ] Clés de signature configurées dans EAS

#### Processus de soumission
```
1. Build EAS Production (AAB signé)
2. Upload via eas submit → Play Console
3. Internal Testing → QA rapide (immédiat)
4. Closed Testing (Alpha) → 7 jours minimum
5. Open Testing (Beta) → optionnel
6. Production → review Google (quelques heures à 3 jours)
```

#### Exigences Google Play spécifiques pour Heal
- [ ] **Déclaration de confidentialité** dans Play Console (Health & Fitness)
- [ ] **Questionnaire données sensibles** : collecte de données de santé (diabète, glycémie…)
- [ ] **In-App Billing** configuré pour les abonnements
- [ ] **App Bundle** (AAB) obligatoire depuis 2021

---

## 5. Checklist pré-lancement (Go-Live)

### Technique
- [ ] Tous les tests CI verts en staging
- [ ] Migrations BDD production appliquées sans erreur
- [ ] Edge Functions déployées et testées en production
- [ ] Variables d'environnement production configurées
- [ ] Stripe mode live activé et testé (paiement réel de €0.50)
- [ ] RevenueCat production configuré et testé
- [ ] Expo Push Notifications testées sur iOS et Android réels
- [ ] Sauvegarde BDD production vérifiée
- [ ] Monitoring Sentry actif et réception d'une erreur test

### Légal & Conformité
- [ ] CGU rédigées et validées (mention HDS, RGPD)
- [ ] Politique de confidentialité rédigée et publiée
- [ ] Mention HDS dans les documents légaux
- [ ] Avertissement médical présent dans l'app
- [ ] DPO (Délégué Protection des Données) désigné et mentionné
- [ ] Processus de droit à l'oubli testé end-to-end
- [ ] Formulaire de contact support fonctionnel

### App Stores
- [ ] Screenshots iOS (6.7", 6.5", 5.5") préparés avec Basile
- [ ] Screenshots Android (téléphone + tablette) préparés
- [ ] Description de l'app rédigée (FR) — 4 000 caractères max
- [ ] Description courte (80 caractères) rédigée
- [ ] Mots-clés optimisés (ASO) : "menu sain", "alimentation saison", "repas équilibré", "diététique chinoise", "producteur local"…
- [ ] Icône Basile aux formats requis (1024×1024 App Store, 512×512 Play)
- [ ] Politique de confidentialité URL publique configurée dans les stores
- [ ] Age rating configuré (4+ iOS, Everyone Android)

### Opérationnel
- [ ] Adresse email support@heal.fr active
- [ ] Page de statut (uptime) configurée (ex : statuspage.io)
- [ ] Runbook (procédures d'incidents) rédigé
- [ ] Alertes monitoring configurées

---

## 6. Monitoring & Observabilité

### Outils de monitoring

| Outil | Usage | Seuil d'alerte |
|---|---|---|
| **Sentry** | Erreurs frontend + Edge Functions | > 5 erreurs/min |
| **Supabase Dashboard** | BDD, API, Auth, Storage | Intégré |
| **Uptime Robot** | Disponibilité heal.app | < 99.9% uptime |
| **Claude API Dashboard** | Usage + latence IA | Latence > 15s |
| **Stripe Dashboard** | Paiements, taux d'échec | Taux échec > 5% |
| **RevenueCat Dashboard** | Abonnements mobiles | MRR, churn |

### Métriques clés à surveiller

**Performance**
```
- Temps de génération planning (P50, P95, P99)
- Latence API /validate-meal (P50, P95)
- Temps de chargement home (P50)
- Taux d'erreur API (%)
```

**Business**
```
- Nouveaux inscrits / jour
- Taux de conversion essai → abonné
- Taux de rétention J7, J30
- MRR (Monthly Recurring Revenue)
- Taux de churn mensuel
- Nombre de plannings générés / jour
- Nombre de repas validés / jour
```

**Santé technique**
```
- Taux d'erreur Claude API
- Latence Claude API (P95)
- Connexions BDD actives
- Taille de la BDD
- Quota de stockage (photos)
```

### Configuration des alertes Sentry

```javascript
// Règles d'alerte Sentry
{
  "generate-meal-plan-error": {
    "condition": "event.tag.function == 'generate-meal-plan'",
    "threshold": 3,
    "window": "1 hour",
    "action": "email + slack"
  },
  "stripe-webhook-error": {
    "condition": "event.tag.function == 'stripe-webhook'",
    "threshold": 1,
    "window": "5 minutes",
    "action": "email + pagerduty"
  },
  "auth-rate-limit": {
    "condition": "event.message contains 'rate limit'",
    "threshold": 50,
    "window": "10 minutes",
    "action": "slack"
  }
}
```

---

## 7. Sauvegarde & Restauration

### Stratégie de sauvegarde

| Type | Fréquence | Rétention | Outil |
|---|---|---|---|
| Backup BDD complet | Quotidien (02h00) | 30 jours | Supabase Pro (automatique) |
| Backup BDD transactionnel (WAL) | Continu | 7 jours | Supabase Pro (automatique) |
| Backup fichiers (photos repas) | Quotidien | 90 jours | Supabase Storage + réplication |
| Backup Edge Functions (code) | À chaque déploiement | Indéfini | Git (GitHub) |

### Procédure de restauration (Runbook)

```
INCIDENT : Perte de données BDD

1. Identifier la fenêtre temporelle de l'incident
2. Notifier les utilisateurs (page de statut)
3. Stopper les Edge Functions (pour éviter nouvelles écritures)
4. Restaurer depuis le backup Supabase :
   supabase db restore --project-ref PROD_REF --timestamp "2026-05-10T20:00:00Z"
5. Vérifier l'intégrité des données restaurées
6. Redémarrer les Edge Functions
7. Test de smoke post-restauration
8. Post-mortem dans les 24h
```

### Objectifs RTO/RPO

| Métrique | Cible | Description |
|---|---|---|
| **RPO** (Recovery Point Objective) | < 24h | Perte de données maximale acceptable |
| **RTO** (Recovery Time Objective) | < 4h | Temps de remise en service maximal |

---

## 8. Gestion des incidents

### Niveaux de sévérité

| Niveau | Description | Exemples | Délai réponse |
|---|---|---|---|
| **P0 — Critique** | App inaccessible ou perte de données | BDD down, API auth KO, Stripe KO | 30 min |
| **P1 — Majeur** | Fonctionnalité principale dégradée | Génération menus en erreur, paiements KO | 2h |
| **P2 — Modéré** | Fonctionnalité secondaire dégradée | Photos non reconnues, notifications KO | 24h |
| **P3 — Mineur** | Bug cosmétique ou edge case | Affichage incorrect, texte erroné | Sprint suivant |

### Procédure d'incident (P0/P1)

```
1. DÉTECTION   → Alerte Sentry / Uptime Robot / signalement utilisateur
2. TRIAGE      → Identifier le composant impacté
3. COMMUNICATION → Mettre à jour la page de statut (dégradé/maintenance)
4. MITIGATION  → Rollback si déploiement récent, sinon hotfix
5. RÉSOLUTION  → Fix déployé, tests de smoke
6. CLÔTURE     → Page de statut mise à jour (résolu)
7. POST-MORTEM → Document rédigé sous 48h (cause, impact, actions correctives)
```

---

## 9. Stratégie de mise à jour

### Versioning

Format : `MAJOR.MINOR.PATCH`
- `MAJOR` : Breaking changes, refonte majeure (rare)
- `MINOR` : Nouvelles fonctionnalités (ex : ajout d'un protocole de jeûne)
- `PATCH` : Correctifs, ajustements mineurs

### OTA Updates (Over-the-Air)

Expo EAS Update permet de déployer des correctifs JavaScript **sans passer par les stores** :

```
Cas d'usage : Bug d'affichage, texte incorrect, correctif logique JS
Délai : Immédiat (appliqué à la prochaine ouverture de l'app)
Limitation : Ne peut pas modifier le code natif (permissions, caméra, etc.)

Commande :
eas update --branch production --message "Fix: affichage streak incorrect"
```

### Politique de support des versions

```
Versions supportées :
  - Version actuelle (N) : support complet
  - Version N-1 : correctifs de sécurité uniquement
  - Versions < N-1 : fin de support, mise à jour forcée

Force update :
  Si une faille de sécurité critique est découverte :
  → Déploiement d'un minimum_version dans la config
  → Les utilisateurs sur des versions inférieures voient un écran de mise à jour obligatoire
```

---

## 10. RGPD — Procédures opérationnelles

### Droit à l'effacement (droit à l'oubli)

```
Déclencheur : Utilisateur supprime son compte (écran 33)

Automatique (immédiat) :
  1. auth.users → compte désactivé
  2. Toutes les sessions invalidées
  3. user_profiles → suppression en cascade (ON DELETE CASCADE)
  4. user_health_data → suppression
  5. meal_plans, meal_validations, etc. → suppression en cascade

Différé (sous 30 jours — via pg_cron) :
  1. Photos stockées dans Supabase Storage → suppression
  2. Données anonymisées agrégées → conservées (stats globales)
  3. user_consents → horodatage de la suppression ajouté

Email automatique : Confirmation de suppression envoyé à J+0
```

### Droit d'accès aux données

```
L'utilisateur peut demander ses données via :
  1. Bouton "Télécharger mes données" (à implémenter — phase 2)
  2. Email à dpo@heal.fr (délai légal : 30 jours)

Format d'export : JSON complet de toutes les tables user_*
```

### Registre des traitements (RGPD Art. 30)

| Traitement | Finalité | Base légale | Durée conservation |
|---|---|---|---|
| Données de compte | Authentification | Contrat | Durée du compte |
| Données physiologiques | Personnalisation menus | Consentement | Durée du compte |
| Données de santé | Adaptation règles nutritionnelles | Consentement explicite | Durée du compte |
| Historique repas | Amélioration personnalisation | Intérêt légitime | 12 mois glissants |
| Photos de repas | Reconnaissance IA | Consentement | 30 jours |
| Logs applicatifs | Sécurité et débogage | Intérêt légitime | 90 jours |
| Données paiement | Facturation | Contrat + obligation légale | 10 ans (comptabilité) |

---

## 11. Roadmap de déploiement — Planning

```
PHASE 0 — Mise en place infrastructure (Semaine 1–2)
  ✓ Création comptes Supabase (staging + prod)
  ✓ Configuration Scaleway HDS
  ✓ Configuration GitHub Actions (CI/CD de base)
  ✓ Configuration Stripe (test + live)
  ✓ Configuration RevenueCat
  ✓ Configuration Sentry
  ✓ Configuration Expo EAS

PHASE 1 — Développement V1 (Semaines 3–18)
  ✓ Sprints de développement (voir backlog)
  ✓ Tests unitaires et d'intégration en parallèle
  ✓ Déploiements staging réguliers (chaque PR mergée)

PHASE 2 — Recette & QA (Semaines 19–21)
  ✓ Tests E2E complets sur staging
  ✓ UAT — checklist manuelle complète
  ✓ Tests de performance (k6)
  ✓ Tests de sécurité
  ✓ Correction des bugs trouvés

PHASE 3 — Pré-lancement (Semaine 22)
  ✓ Soumission App Store (TestFlight)
  ✓ Soumission Google Play (Internal track)
  ✓ Validation Apple Review (48–72h)
  ✓ Validation Google Review (24–48h)
  ✓ Vérification checklist légale complète

PHASE 4 — Lancement (Semaine 23)
  ✓ Go-live production
  ✓ Release manuelle sur les stores
  ✓ Monitoring renforcé J1–J7
  ✓ Support utilisateurs actif

PHASE 5 — Post-lancement (Semaines 24+)
  → Correctifs basés sur les retours utilisateurs
  → Optimisations performance basées sur les métriques
  → Préparation Phase 2 (multilingue, objets connectés)
```

---

*Livrable 7 / 7 — Heal — Mai 2026*
