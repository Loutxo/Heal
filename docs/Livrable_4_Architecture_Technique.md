# Heal — Architecture Technique

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)

> **v1.1 — Changelog :** renommage Harméal → Heal (domaines, repo, projets Supabase) ; prompt système Claude enrichi des règles MTC légères.

---

## Vue d'ensemble

Heal est une application mobile (iOS + Android) avec une web app companion, construite sur une architecture **serverless / BaaS** pour minimiser la complexité opérationnelle et les coûts en phase de lancement.

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│                                                                   │
│   📱 React Native (iOS)   📱 React Native (Android)              │
│   🌐 React Native Web (web app companion)                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │ HTTPS / WSS
┌──────────────────────────▼──────────────────────────────────────┐
│                     SUPABASE (BaaS — HDS)                        │
│                                                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  Auth       │  │  PostgREST  │  │  Realtime (WebSocket)    │ │
│  │  (JWT)      │  │  (API REST) │  │  (mises à jour live)     │ │
│  └─────────────┘  └─────────────┘  └──────────────────────────┘ │
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │              PostgreSQL (HDS — données chiffrées)           │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  ┌─────────────┐  ┌─────────────────────────────────────────┐   │
│  │  Storage    │  │  Edge Functions (Deno / TypeScript)     │   │
│  │  (photos)   │  │  (logique métier, appels API externes)  │   │
│  └─────────────┘  └─────────────────────────────────────────┘   │
└──────────┬────────────────────┬────────────────────┬────────────┘
           │                    │                    │
┌──────────▼──────┐  ┌──────────▼──────┐  ┌────────▼────────────┐
│   Claude API    │  │  Google Vision  │  │  RevenueCat / Stripe │
│  (Anthropic)    │  │  (photo IA)     │  │  (paiement & abo)   │
│  Génération     │  │  Reconnaissance │  │                      │
│  des menus      │  │  aliments       │  │                      │
└─────────────────┘  └─────────────────┘  └─────────────────────┘
```

---

## Stack technique détaillée

### Frontend — React Native + Expo

| Composant | Technologie | Justification |
|---|---|---|
| Framework | **React Native 0.74+** via **Expo SDK 51+** | iOS + Android + Web en une codebase, écosystème mature |
| Navigation | **Expo Router** (file-based routing) | Navigation native, deep links, web URLs |
| State management | **Zustand** | Simple, léger, pas de boilerplate Redux |
| Requêtes API | **TanStack Query (React Query)** | Cache, invalidation, synchronisation offline |
| UI Components | **Custom** basé sur la charte Heal | Cohérence brand, pas de lib générique |
| Animations | **Reanimated 3** + **Lottie** | Animations de Basile (JSON Lottie) |
| Formulaires | **React Hook Form** + **Zod** | Validation côté client |
| Internationalisation | **i18next** (prêt pour phase 2 multilingue) | Chaînes FR en v1, extensible |
| Notifications push | **Expo Notifications** | Abstraction iOS/Android |
| Caméra / Galerie | **Expo Camera** + **Expo Image Picker** | Photo repas |
| Stockage local | **Expo SecureStore** (tokens) + **MMKV** (cache) | Sécurité + performance |
| Build | **Expo EAS Build** | CI/CD cloud, OTA updates |

---

### Backend — Supabase (BaaS)

| Composant | Technologie | Rôle |
|---|---|---|
| Base de données | **PostgreSQL 16** | Données principales |
| API REST | **PostgREST** (auto-généré) | CRUD sur toutes les tables |
| Authentification | **Supabase Auth** | JWT, OAuth (Apple/Google/Microsoft) |
| Realtime | **Supabase Realtime** | Mises à jour live (validation repas, points) |
| Stockage fichiers | **Supabase Storage** | Photos de repas (bucket privé) |
| Logique métier | **Supabase Edge Functions** (Deno) | Appels IA, calculs complexes, webhooks |
| Sécurité | **Row Level Security (RLS)** | Isolation des données par utilisateur |
| Tâches planifiées | **pg_cron** (extension PostgreSQL) | Génération rapports hebdomadaires, expiration essais |

#### Edge Functions clés

| Fonction | Déclencheur | Description |
|---|---|---|
| `generate-meal-plan` | API call | Appel Claude API, construction planning, insertion BDD |
| `validate-meal-photo` | API call | Appel Google Vision, analyse nutritionnelle |
| `calculate-weekly-report` | pg_cron (dimanche 19h45) | Calcul scores, génération rapport, notification push |
| `check-badge-unlocks` | Trigger PostgreSQL | Vérifie conditions badges après chaque validation |
| `handle-subscription-webhook` | Webhook Stripe/RevenueCat | Mise à jour statut abonnement |
| `send-push-notification` | pg_cron (horaires configurés) | Envoi notifications push via Expo Push API |
| `expire-trials` | pg_cron (quotidien 00:01) | Passage statut trial → expired |

---

### Services externes

#### Claude API (Anthropic) — Génération des menus
```
Modèle : claude-sonnet-4-6 (coût/performance optimal)
Prompt système : Règles nutritionnelles Heal + contraintes profil
Prompt utilisateur : Profil sérialisé + aliments disponibles + saison
Output : JSON structuré (planning 7 jours × 4 repas)
Prompt caching : Activé sur le prompt système (économie ~80%)
Timeout : 30 secondes max
Retry : 2 tentatives en cas d'échec
```

**Structure du prompt système (cacheable) :**
```
[Règles diététiques générales Heal]
[Base de règles IG/CG par pathologie]
[Règles MTC légères : nudge nature énergétique ↔ saison, jamais un filtre d'exclusion]
[Format de sortie JSON attendu]
[Règles de saisonnalité]
[Règles de batch cooking]
```

**Structure du prompt utilisateur (dynamique) :**
```
[Profil: age, sexe, IMC, activité, pathologies, allergies, région]
[Mois en cours + aliments de saison disponibles]
[Aliments disponibles déclarés par l'utilisateur]
[Contraintes de la semaine: nb repas, jeûne activé/non, collation]
[Historique: repas des 2 dernières semaines à éviter]
```

---

#### Google Cloud Vision — Reconnaissance photo repas
```
API : Vision API v1 — LABEL_DETECTION + OBJECT_LOCALIZATION
Appel : Via Edge Function (clé API côté serveur uniquement)
Timeout : 10 secondes
Fallback : Saisie manuelle si confiance < 60%
```

---

#### RevenueCat — Gestion des abonnements mobile
```
Rôle : Couche d'abstraction App Store + Google Play
Avantage : Une seule API pour gérer iOS et Android
Webhooks : Envoyés vers Edge Function handle-subscription-webhook
Supabase Stripe : Utilisé pour les paiements web (hors stores)
```

---

#### Expo Push API — Notifications push
```
Service : Expo Push Notification Service
Tokens : Stockés en base, associés à user_id + platform
Déclencheur : Edge Function send-push-notification via pg_cron
```

---

## Sécurité

### Authentification & Autorisation
```
Tokens JWT émis par Supabase Auth
Durée de vie access token : 1 heure
Durée de vie refresh token : 30 jours ("Rester connecté")
Stockage token : Expo SecureStore (keychain iOS / keystore Android)
RLS : Active sur toutes les tables contenant des données utilisateur
Clés API externes : Stockées dans Supabase Secrets (jamais côté client)
```

### Données de santé (RGPD & HDS)
```
Hébergement : Scaleway HDS (certification HDS française)
Chiffrement at-rest : AES-256 (inclus Supabase sur Scaleway HDS)
Chiffrement in-transit : TLS 1.3 minimum
Pseudonymisation : user_id UUID (non lié à l'email en BDD publique)
Données sensibles : Dans user_health_data (RLS stricte, accès admin restreint)
Logs : Pas de données personnelles dans les logs applicatifs
```

### Sécurité applicative
```
Rate limiting : 100 requêtes/minute par IP sur les endpoints auth
Validation : Zod côté client + contraintes PostgreSQL côté serveur
Injection SQL : Impossible via PostgREST (requêtes paramétrées)
XSS : Non applicable (React Native, pas de DOM)
CORS : Origines autorisées listées explicitement dans Supabase
```

---

## Performance

### Cibles de performance
| Métrique | Cible | Critique |
|---|---|---|
| Génération planning semaine | < 10 secondes | Oui |
| Chargement home / planning | < 1 seconde | Oui |
| Validation repas (1 clic) | < 500ms | Oui |
| Reconnaissance photo | < 5 secondes | Non |
| Rapport hebdomadaire (background) | < 60 secondes | Non |

### Stratégies d'optimisation
```
TanStack Query : Cache client des données (planning, liste courses)
Supabase Realtime : Push des mises à jour (points, badges) sans polling
Pagination : Historique des rapports et points paginé (12 items / page)
Lazy loading : Écrans chargés à la demande (Expo Router)
Images : Optimisées via Expo Image (WebP, lazy load)
Claude API : Prompt caching sur la partie système (économie latence + coût)
```

---

## Environnements

| Environnement | Usage | URL | BDD |
|---|---|---|---|
| **Development** | Développement local | localhost | Supabase local (CLI) |
| **Staging** | Tests QA et recette | staging.heal.app | Supabase projet staging |
| **Production** | App en production | heal.app | Supabase projet prod (HDS) |

### Variables d'environnement

```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=               # Côté client (sécurisé par RLS)
SUPABASE_SERVICE_ROLE_KEY=       # Côté Edge Functions uniquement

# IA (stockées dans Supabase Secrets — jamais côté client)
ANTHROPIC_API_KEY=
GOOGLE_VISION_API_KEY=

# Paiement (stockées dans Supabase Secrets)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
REVENUECAT_API_KEY=

# Notifications
EXPO_ACCESS_TOKEN=

# App
APP_ENV=development|staging|production
TRIAL_DURATION_DAYS=30
```

---

## CI/CD Pipeline

```
Développeur → Push branche feature
      ↓
GitHub Actions — PR Check :
  ├── Lint (ESLint + Prettier)
  ├── Type check (TypeScript strict)
  ├── Tests unitaires (Jest)
  └── Tests d'intégration (API staging)
      ↓ (si tout vert)
Merge sur main
      ↓
GitHub Actions — Deploy Staging :
  ├── Build Expo EAS (iOS + Android + Web)
  ├── Deploy web → Staging URL
  └── Notification Slack / email
      ↓ (validation manuelle QA)
Tag de release (vX.Y.Z)
      ↓
GitHub Actions — Deploy Production :
  ├── Build Expo EAS Production
  ├── Submit App Store (TestFlight → Review → Release)
  ├── Submit Google Play (Internal → Alpha → Production)
  ├── Deploy web → Production
  └── OTA Update (correctifs mineurs sans soumission stores)
```

---

## Scalabilité

### Limites actuelles et seuils de migration

| Composant | Limite v1 | Migration si dépassement |
|---|---|---|
| Supabase (plan Pro) | 8 Go BDD, 100 Go storage, 5M requêtes/mois | Supabase Team ou self-hosted |
| Claude API | ~10 000 générations/mois estimées | Augmentation quota Anthropic |
| Google Vision | 1 000 appels/mois gratuits, puis $1.50/1000 | Négligeable |
| Supabase Edge Functions | 500 000 invocations/mois incluses | Inclus jusqu'à ~50 000 utilisateurs |

### Architecture phase 2 (si > 50 000 utilisateurs)
```
→ Migration vers Supabase self-hosted sur Scaleway (HDS)
→ Ajout Redis (Upstash) pour cache des plannings populaires
→ Queue de génération (Bull + Redis) pour les pics de demande
→ CDN pour les assets statiques (Cloudflare)
```

---

## Coûts mensuels estimés

| Service | Plan | Coût estimé/mois |
|---|---|---|
| Supabase (BDD + Auth + Storage + Edge Functions) | Pro | 25 € |
| Scaleway HDS (hébergement conforme données santé) | Starter | 15–30 € |
| Claude API (Anthropic) | Pay-as-you-go | 30–80 € (selon volume) |
| Google Cloud Vision | Pay-as-you-go | 5–20 € |
| RevenueCat | Starter (< 2 500 $ MRR) | 0 € |
| Stripe | 1.4% + 0.25€ par transaction EU | Variable |
| Expo EAS (builds CI/CD) | Production | 29 $ |
| **Total infrastructure** | | **~105–185 €/mois** |

---

## Choix techniques justifiés

| Décision | Alternative écartée | Raison du choix |
|---|---|---|
| React Native + Expo | Flutter, Swift natif | Une codebase pour iOS/Android/Web, écosystème JS familier |
| Supabase | Firebase, AWS Amplify | PostgreSQL (vs Firestore), hébergement EU HDS possible, open-source |
| Claude API | GPT-4o, Gemini | Qualité de génération nutritionnelle, prompt caching, contrôle Anthropic |
| RevenueCat | Stripe direct pour mobile | Gestion automatique App Store + Google Play (règles complexes) |
| Expo EAS | Fastlane + custom CI | Simplicité, OTA updates sans passer par les stores |
| Zustand | Redux, Jotai, Context | Simplicité, performance, zéro boilerplate |
| TanStack Query | SWR, Apollo | Cache avancé, synchronisation offline, deduplication requêtes |

---

*Livrable 4 / 7 — Heal — Mai 2026*
