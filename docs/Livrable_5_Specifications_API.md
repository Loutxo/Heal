# Heal — Spécifications API

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)  
**Base URL :** `https://[project].supabase.co`  
**Authentification :** Bearer JWT (Supabase Auth)

> **v1.1 — Changelog :** renommage Harméal → Heal ; champs `tcm_nature`/`tcm_flavor` ajoutés aux réponses repas/aliments/saisonnalité ; nouvel endpoint §9bis pour le lien producteurs locaux.

---

## Conventions

### Headers obligatoires (toutes les requêtes authentifiées)
```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
apikey: <supabase_anon_key>
```

### Codes de statut HTTP
| Code | Signification |
|---|---|
| 200 | Succès |
| 201 | Créé avec succès |
| 204 | Succès sans contenu (DELETE) |
| 400 | Requête invalide (validation échouée) |
| 401 | Non authentifié |
| 403 | Accès refusé (RLS ou abonnement requis) |
| 404 | Ressource introuvable |
| 409 | Conflit (doublon) |
| 422 | Entité non traitable (règles métier) |
| 429 | Trop de requêtes (rate limit) |
| 500 | Erreur serveur |

### Format des erreurs
```json
{
  "error": {
    "code": "MEAL_ALREADY_VALIDATED",
    "message": "Ce repas a déjà été validé.",
    "details": null
  }
}
```

### Types d'endpoints
- **PostgREST** : API REST auto-générée par Supabase sur les tables PostgreSQL
- **Edge Functions** : Logique métier custom sur `https://[project].supabase.co/functions/v1/`

---

## 1. AUTHENTIFICATION

> Endpoints gérés par **Supabase Auth**. URL de base : `/auth/v1/`

---

### POST /auth/v1/signup
Inscription par email + mot de passe.

**Body :**
```json
{
  "email": "user@example.com",
  "password": "Password1!",
  "data": {
    "first_name": "Marie"
  }
}
```

**Réponse 200 :**
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "email_confirmed_at": null,
    "created_at": "2026-05-11T10:00:00Z"
  },
  "session": null
}
```

**Erreurs spécifiques :**
- `400` : Email invalide, mot de passe trop faible
- `409` : Email déjà utilisé

---

### POST /auth/v1/token?grant_type=password
Connexion par email + mot de passe.

**Body :**
```json
{
  "email": "user@example.com",
  "password": "Password1!"
}
```

**Réponse 200 :**
```json
{
  "access_token": "jwt...",
  "token_type": "bearer",
  "expires_in": 3600,
  "refresh_token": "...",
  "user": { "id": "uuid", "email": "..." }
}
```

**Erreurs :**
- `400` : Identifiants invalides
- `429` : Trop de tentatives (verrouillage 15 min)

---

### POST /auth/v1/token?grant_type=refresh_token
Renouvellement du token d'accès.

**Body :**
```json
{ "refresh_token": "..." }
```

---

### POST /auth/v1/recover
Demande de réinitialisation du mot de passe.

**Body :**
```json
{ "email": "user@example.com" }
```

**Réponse 200 :** Toujours le même message (sécurité — ne révèle pas si l'email existe)
```json
{ "message": "Si cet email existe, un lien de réinitialisation a été envoyé." }
```

---

### POST /auth/v1/logout
Déconnexion (invalidation du token côté serveur).

**Headers :** Authorization requis

**Réponse 204**

---

### POST /functions/v1/delete-account
Suppression du compte et de toutes les données (RGPD).

🔒 Authentifié

**Body :**
```json
{ "password": "Password1!" }
```

**Réponse 200 :**
```json
{ "message": "Compte supprimé. Vos données seront effacées sous 30 jours." }
```

**Erreurs :**
- `401` : Mot de passe incorrect

---

## 2. PROFIL UTILISATEUR

> Via PostgREST sur les tables `user_profiles`, `user_health_data`, `user_restrictions`.

---

### GET /rest/v1/user_profiles?id=eq.{user_id}
Récupération du profil complet.

🔒 Authentifié — RLS : utilisateur voit uniquement son propre profil

**Réponse 200 :**
```json
[{
  "id": "uuid",
  "first_name": "Marie",
  "region_id": 3,
  "birth_date": "1985-04-12",
  "sex": "female",
  "height_cm": 165,
  "weight_kg": 68.5,
  "bmi": 25.16,
  "activity_level": "moderate",
  "fasting_protocol": null,
  "snack_enabled": true,
  "onboarding_completed": true,
  "locale": "fr",
  "trial_started_at": "2026-05-11T10:00:00Z"
}]
```

---

### PATCH /rest/v1/user_profiles?id=eq.{user_id}
Mise à jour du profil.

🔒 Authentifié

**Body (partiel — seuls les champs à modifier) :**
```json
{
  "weight_kg": 67.0,
  "activity_level": "light"
}
```

**Réponse 200 :** Profil mis à jour

**Effets de bord :** Si `weight_kg`, `activity_level`, `region_id` ou données de santé sont modifiés → le planning de la semaine en cours doit être régénéré (géré côté client avec confirmation utilisateur).

---

### GET /rest/v1/user_health_data?user_id=eq.{user_id}
Récupération des données de santé.

🔒 Authentifié — données sensibles (HDS)

**Réponse 200 :**
```json
[{
  "user_id": "uuid",
  "pathologies": ["prediabetes"],
  "fasting_glucose": 1.18,
  "hba1c": null,
  "total_cholesterol": null,
  "triglycerides": null,
  "consent_given_at": "2026-05-11T10:05:00Z"
}]
```

---

### PUT /rest/v1/user_health_data?user_id=eq.{user_id}
Création ou mise à jour des données de santé (upsert).

🔒 Authentifié

**Body :**
```json
{
  "pathologies": ["prediabetes", "hypercholesterolemia"],
  "fasting_glucose": 1.22,
  "consent_given_at": "2026-05-11T10:05:00Z"
}
```

---

### GET /rest/v1/user_restrictions?user_id=eq.{user_id}
Récupération des allergies et restrictions.

🔒 Authentifié

---

### PATCH /rest/v1/user_restrictions?user_id=eq.{user_id}
Mise à jour des allergies et restrictions.

🔒 Authentifié

**Body :**
```json
{
  "allergies": ["gluten", "lactose"],
  "diet_preferences": ["vegetarian"],
  "disliked_foods": ["coriandre", "betterave"]
}
```

---

## 3. GÉNÉRATION DE MENUS

---

### POST /functions/v1/generate-meal-plan
Génération d'un planning semaine via Claude API.

🔒 Authentifié + Abonné (essai ou payant)

**Body :**
```json
{
  "week_start": "2026-05-12",
  "available_food_ids": [42, 87, 203],
  "force_regenerate": false
}
```

**Paramètres :**
- `week_start` : Lundi de la semaine (format ISO date)
- `available_food_ids` : IDs des aliments déjà disponibles (optionnel)
- `force_regenerate` : `true` pour écraser un planning existant

**Réponse 200 :**
```json
{
  "meal_plan_id": "uuid",
  "week_start": "2026-05-12",
  "meals": [
    {
      "id": "uuid",
      "meal_date": "2026-05-12",
      "meal_type": "breakfast",
      "name": "Porridge aux myrtilles et graines de chia",
      "glycemic_level": "low",
      "estimated_glycemic_load": 18.5,
      "eating_order": ["Myrtilles", "Porridge avoine", "Graines de chia"],
      "tcm_nature_dominant": "neutral",
      "foods": [
        {
          "food_id": 45,
          "name": "Flocons d'avoine",
          "quantity_g": 60,
          "quantity_concrete": "6 cuillères à soupe",
          "tcm_nature": "neutral",
          "tcm_flavor": ["sweet"]
        },
        {
          "food_id": 112,
          "name": "Myrtilles",
          "quantity_g": 80,
          "quantity_concrete": "une petite poignée",
          "is_out_of_season": false
        }
      ]
    }
    // ... 27 autres repas (7 jours × 4 types)
  ],
  "shopping_list_id": "uuid",
  "batch_cooking_guide_id": "uuid"
}
```

**Erreurs :**
- `403` : Essai expiré ou pas d'abonnement actif
- `409` : Planning déjà existant pour cette semaine (`force_regenerate: false`)
- `422` : Impossible de générer (trop de restrictions combinées)
- `500` : Erreur Claude API (retry automatique côté serveur)

---

### POST /functions/v1/swap-meal
Remplacement d'un repas spécifique.

🔒 Authentifié + Abonné

**Body :**
```json
{
  "meal_id": "uuid",
  "attempt_number": 1
}
```

**Réponse 200 :** Même format qu'un objet `meal` dans generate-meal-plan

**Erreurs :**
- `400` : `attempt_number` > 3 (maximum atteint)
- `403` : Repas déjà validé (swap impossible)
- `422` : Aucune alternative disponible

---

### GET /rest/v1/meal_plans?user_id=eq.{user_id}&week_start=eq.{date}&status=eq.active
Récupération du planning de la semaine.

🔒 Authentifié + Abonné

**Query params :**
- `select=*,meals(*,meal_foods(*,foods(*)))` : Jointures imbriquées

---

### GET /rest/v1/meals?id=eq.{meal_id}
Détail d'un repas spécifique.

🔒 Authentifié + Abonné

**Query params :**
- `select=*,meal_foods(*,foods(*,food_nutrients(*)))`

---

## 4. LISTE DE COURSES

---

### GET /rest/v1/shopping_lists?user_id=eq.{user_id}
Récupération de la liste de la semaine courante.

🔒 Authentifié + Abonné

**Query params :**
- `select=*,shopping_list_items(*)`
- `order=shopping_list_items.sort_order.asc`

**Réponse 200 :**
```json
[{
  "id": "uuid",
  "meal_plan_id": "uuid",
  "items": [
    {
      "id": "uuid",
      "food_id": 42,
      "name": "Carottes",
      "quantity_label": "450g — environ 6 carottes",
      "shopping_section": "produce",
      "is_checked": false,
      "is_manual": false,
      "is_seasonal": true,
      "sort_order": 1
    }
  ]
}]
```

---

### PATCH /rest/v1/shopping_list_items?id=eq.{item_id}
Cocher / décocher un article.

🔒 Authentifié

**Body :**
```json
{ "is_checked": true }
```

---

### POST /rest/v1/shopping_list_items
Ajout d'un article manuel à la liste.

🔒 Authentifié

**Body :**
```json
{
  "shopping_list_id": "uuid",
  "name": "Tahini",
  "quantity_label": "1 pot",
  "shopping_section": "dry_goods",
  "is_manual": true,
  "sort_order": 99
}
```

---

### DELETE /rest/v1/shopping_list_items?id=eq.{item_id}
Suppression d'un article.

🔒 Authentifié

**Réponse 204**

---

### POST /functions/v1/export-shopping-list
Export de la liste au format texte.

🔒 Authentifié + Abonné

**Body :**
```json
{
  "shopping_list_id": "uuid",
  "include_checked": false
}
```

**Réponse 200 :**
```json
{
  "text": "🥕 Légumes & Fruits\n- Carottes : 450g (environ 6 carottes)\n- Courgettes : 300g\n..."
}
```

---

## 5. BATCH COOKING

---

### GET /functions/v1/batch-cooking-guide/{meal_plan_id}
Récupération du guide complet (week-end + quotidien).

🔒 Authentifié + Abonné

**Réponse 200 :**
```json
{
  "guide_id": "uuid",
  "weekend_estimated_active_min": 115,
  "weekend_estimated_passive_min": 180,
  "basile_tip": "Lancez le mijoté en premier — il cuisinera tout seul pendant que vous préparez le reste !",
  "weekend_tasks": [
    {
      "id": "uuid",
      "task_category": "passive_cooking",
      "description": "Mijoté de bœuf aux carottes — 3h à 160°C",
      "foods_involved": ["Bœuf", "Carottes", "Oignons"],
      "estimated_duration_min": 180,
      "sort_order": 1,
      "is_completed": false
    }
  ],
  "daily_tasks": {
    "2026-05-12": [...],
    "2026-05-13": [...],
    "2026-05-14": [...],
    "2026-05-15": [...],
    "2026-05-16": [...],
    "2026-05-17": [...],
    "2026-05-18": [...]
  }
}
```

---

### PATCH /rest/v1/batch_tasks?id=eq.{task_id}
Cocher une tâche batch cooking.

🔒 Authentifié

**Body :**
```json
{ "is_completed": true }
```

---

## 6. VALIDATION DES REPAS

---

### POST /functions/v1/validate-meal
Validation d'un repas (1 clic, photo ou texte).

🔒 Authentifié + Abonné

**Body — Validation 1 clic :**
```json
{
  "meal_id": "uuid",
  "validation_method": "one_click"
}
```

**Body — Validation par texte :**
```json
{
  "meal_id": "uuid",
  "validation_method": "text_search",
  "detected_foods": [
    { "food_id": 45, "quantity_g": 150 },
    { "food_id": 112, "quantity_g": 80 }
  ]
}
```

**Body — Validation par photo :**
```json
{
  "meal_id": "uuid",
  "validation_method": "photo",
  "photo_url": "https://[project].supabase.co/storage/v1/object/meal-photos/uuid.jpg",
  "confirmed_foods": [
    { "food_id": 45, "quantity_g": 150 }
  ]
}
```

**Réponse 200 :**
```json
{
  "validation_id": "uuid",
  "points_earned": 15,
  "total_points": 347,
  "streak_current": 5,
  "new_badges": [
    {
      "id": 3,
      "slug": "three_day_streak",
      "name": "3 jours d'affilée",
      "icon": "🔥"
    }
  ],
  "basile_message": {
    "text": "Excellent ! Les fibres des haricots verts ont ralenti l'absorption des pâtes. Ton insuline est restée calme. +15 points !",
    "animation": "happy"
  }
}
```

**Erreurs :**
- `409` : Repas déjà validé
- `422` : Délai de 24h dépassé (validation tardive impossible)

---

### POST /functions/v1/analyze-meal-photo
Analyse d'une photo de repas par Google Vision (avant confirmation).

🔒 Authentifié + Abonné

**Body :**
```json
{
  "photo_base64": "data:image/jpeg;base64,..."
}
```

**Réponse 200 :**
```json
{
  "photo_url": "https://[project].supabase.co/storage/v1/object/meal-photos/uuid.jpg",
  "detected_foods": [
    {
      "food_id": 45,
      "name": "Saumon",
      "confidence": 0.89,
      "estimated_quantity_g": 150
    },
    {
      "food_id": 201,
      "name": "Haricots verts",
      "confidence": 0.76,
      "estimated_quantity_g": 120
    }
  ],
  "has_allergen_warning": false,
  "overall_confidence": 0.82
}
```

**Réponse 200 (faible confiance) :**
```json
{
  "photo_url": "...",
  "detected_foods": [],
  "overall_confidence": 0.35,
  "fallback_message": "Basile n'arrive pas à bien voir ce plat. Pouvez-vous saisir les aliments manuellement ?"
}
```

---

## 7. GAMIFICATION

---

### GET /rest/v1/user_points?user_id=eq.{user_id}
Solde de points de l'utilisateur.

🔒 Authentifié

---

### GET /rest/v1/points_history?user_id=eq.{user_id}&order=earned_at.desc&limit=50
Historique des points (paginé).

🔒 Authentifié

**Query params :**
- `offset=0` : Pour la pagination

---

### GET /rest/v1/user_streaks?user_id=eq.{user_id}
Streak actuel et record.

🔒 Authentifié

---

### GET /rest/v1/user_badges?user_id=eq.{user_id}&select=*,badges(*)
Badges débloqués par l'utilisateur avec détails.

🔒 Authentifié

---

### GET /rest/v1/badges?order=sort_order.asc
Tous les badges disponibles (référentiel).

🔒 Authentifié (pas d'abonnement requis)

---

## 8. RAPPORTS HEBDOMADAIRES

---

### GET /rest/v1/weekly_reports?user_id=eq.{user_id}&order=week_start.desc&limit=12
Historique des 12 derniers rapports.

🔒 Authentifié + Abonné

---

### GET /rest/v1/weekly_reports?user_id=eq.{user_id}&week_start=eq.{date}
Rapport d'une semaine spécifique.

🔒 Authentifié + Abonné

**Réponse 200 :**
```json
[{
  "id": "uuid",
  "week_start": "2026-05-05",
  "meals_validated": 22,
  "meals_total": 28,
  "glycemic_score": 84.5,
  "glycemic_level": "low",
  "food_diversity_score": 18,
  "top_meals": ["uuid1", "uuid2", "uuid3"],
  "basile_advice": "Excellente semaine ! Essayez d'intégrer davantage de légumineuses la semaine prochaine pour booster vos fibres.",
  "generated_at": "2026-05-10T20:00:00Z"
}]
```

---

## 9. SAISONNALITÉ

---

### GET /functions/v1/seasonal-foods
Aliments de saison pour la région et le mois de l'utilisateur.

🔒 Authentifié (pas d'abonnement requis)

**Query params :**
- `month` : 1–12 (défaut : mois courant)
- `region_id` : ID de la région (défaut : région du profil)
- `category` : `produce` | `fruits` | tous (optionnel)

**Réponse 200 :**
```json
{
  "month": 5,
  "region": "Île-de-France",
  "foods": [
    {
      "id": 42,
      "name": "Asperges",
      "category": "Légumes",
      "icon": "🌿",
      "glycemic_index": 15,
      "health_benefits": ["fiber", "vitamin_k", "folate"],
      "tcm_nature": "cool",
      "tcm_flavor": ["bitter", "sweet"],
      "basile_message": "Les asperges sont excellentes pour votre foie et riches en prébiotiques.",
      "basile_message_tcm": "Nature fraîche, saveur douce et légèrement amère — les asperges aident à drainer et rafraîchir au printemps.",
      "storage_days_fridge": 3,
      "in_current_plan": true
    }
  ]
}
```

---

### GET /rest/v1/regions?order=country.asc,name.asc
Liste de toutes les régions disponibles.

Public (pas d'authentification requise)

---

### GET /functions/v1/local-producers-link
Ressource externe recommandée pour trouver des producteurs locaux, selon la région de l'utilisateur (US-034). **Ne renvoie pas d'inventaire producteur** — c'est une redirection contextuelle, pas un annuaire (cf. Product Brief §10 : aucune base de données nationale unifiée n'existe en accès libre).

🔒 Authentifié (pas d'abonnement requis)

**Query params :**
- `region_id` : ID de la région (défaut : région du profil)

**Réponse 200 :**
```json
{
  "region": "Île-de-France",
  "resources": [
    { "label": "Agrilocal — producteurs en circuit court", "url": "https://www.agrilocal.fr/" },
    { "label": "Bienvenue à la ferme", "url": "https://www.bienvenue-a-la-ferme.com/" }
  ],
  "basile_message": "Basile connaît de bonnes adresses près de chez vous !"
}
```

**Note d'implémentation :** liste de ressources maintenue manuellement par région (config statique côté Edge Function), pas de scraping ni d'agrégation temps réel en v1.

---

## 10. ABONNEMENT & PAIEMENT

---

### GET /rest/v1/subscriptions?user_id=eq.{user_id}
Statut de l'abonnement.

🔒 Authentifié

**Réponse 200 :**
```json
[{
  "user_id": "uuid",
  "status": "trial",
  "plan": null,
  "trial_ends_at": "2026-06-10T10:00:00Z",
  "current_period_end": null
}]
```

---

### POST /functions/v1/create-checkout-session
Création d'une session Stripe Checkout (web).

🔒 Authentifié

**Body :**
```json
{
  "plan": "monthly",
  "success_url": "https://heal.app/payment/success",
  "cancel_url": "https://heal.app/subscription"
}
```

**Réponse 200 :**
```json
{
  "checkout_url": "https://checkout.stripe.com/..."
}
```

---

### POST /functions/v1/cancel-subscription
Résiliation de l'abonnement (web/Stripe uniquement — les mobiles passent par les stores).

🔒 Authentifié

**Réponse 200 :**
```json
{
  "message": "Abonnement résilié. Vous gardez l'accès jusqu'au 2026-06-10.",
  "access_until": "2026-06-10T00:00:00Z"
}
```

---

### POST /functions/v1/stripe-webhook
Webhook Stripe (non authentifié — vérifié par signature Stripe).

**Headers :**
```
Stripe-Signature: t=...,v1=...
```

**Events traités :**
- `checkout.session.completed` → Activation abonnement
- `invoice.payment_succeeded` → Renouvellement
- `invoice.payment_failed` → Passage en `past_due`
- `customer.subscription.deleted` → Passage en `canceled`

---

### POST /functions/v1/revenuecat-webhook
Webhook RevenueCat pour les abonnements mobiles (App Store / Google Play).

**Events traités :**
- `INITIAL_PURCHASE` → Activation abonnement
- `RENEWAL` → Renouvellement
- `CANCELLATION` → Résiliation
- `EXPIRATION` → Expiration

---

## 11. NOTIFICATIONS

---

### PATCH /rest/v1/user_profiles?id=eq.{user_id}
Mise à jour des préférences de notifications (inclus dans le profil général).

**Body :**
```json
{
  "notification_settings": {
    "dinner_reminder": { "enabled": true, "time": "19:30" },
    "shopping_reminder": { "enabled": true, "day": 5, "time": "18:00" },
    "batch_cooking_reminder": { "enabled": false },
    "weekly_report": { "enabled": true, "time": "20:00" },
    "badge_unlocked": { "enabled": true }
  }
}
```

---

## 12. RÉFÉRENTIELS (données statiques)

---

### GET /rest/v1/foods
Base de données des aliments (avec filtres).

Public (pas d'authentification requise pour la recherche)

**Query params clés :**
- `name=ilike.*carotte*` : Recherche partielle insensible à la casse
- `category_id=eq.1` : Filtrer par catégorie
- `is_active=eq.true` : Aliments actifs uniquement
- `select=id,name,glycemic_index,category_id,unit_concrete_label`
- `limit=20&offset=0` : Pagination

---

### GET /rest/v1/food_categories?order=sort_order.asc
Catégories d'aliments.

Public

---

## Résumé des endpoints

| # | Méthode | Endpoint | Auth | Abo requis |
|---|---|---|---|---|
| 1 | POST | /auth/v1/signup | Non | Non |
| 2 | POST | /auth/v1/token (password) | Non | Non |
| 3 | POST | /auth/v1/token (refresh) | Non | Non |
| 4 | POST | /auth/v1/recover | Non | Non |
| 5 | POST | /auth/v1/logout | Oui | Non |
| 6 | POST | /functions/v1/delete-account | Oui | Non |
| 7 | GET | /rest/v1/user_profiles | Oui | Non |
| 8 | PATCH | /rest/v1/user_profiles | Oui | Non |
| 9 | GET | /rest/v1/user_health_data | Oui | Non |
| 10 | PUT | /rest/v1/user_health_data | Oui | Non |
| 11 | GET | /rest/v1/user_restrictions | Oui | Non |
| 12 | PATCH | /rest/v1/user_restrictions | Oui | Non |
| 13 | POST | /functions/v1/generate-meal-plan | Oui | **Oui** |
| 14 | POST | /functions/v1/swap-meal | Oui | **Oui** |
| 15 | GET | /rest/v1/meal_plans | Oui | **Oui** |
| 16 | GET | /rest/v1/meals | Oui | **Oui** |
| 17 | GET | /rest/v1/shopping_lists | Oui | **Oui** |
| 18 | PATCH | /rest/v1/shopping_list_items (check) | Oui | Non |
| 19 | POST | /rest/v1/shopping_list_items | Oui | Non |
| 20 | DELETE | /rest/v1/shopping_list_items | Oui | Non |
| 21 | POST | /functions/v1/export-shopping-list | Oui | **Oui** |
| 22 | GET | /functions/v1/batch-cooking-guide | Oui | **Oui** |
| 23 | PATCH | /rest/v1/batch_tasks | Oui | Non |
| 24 | POST | /functions/v1/validate-meal | Oui | **Oui** |
| 25 | POST | /functions/v1/analyze-meal-photo | Oui | **Oui** |
| 26 | GET | /rest/v1/user_points | Oui | Non |
| 27 | GET | /rest/v1/points_history | Oui | Non |
| 28 | GET | /rest/v1/user_streaks | Oui | Non |
| 29 | GET | /rest/v1/user_badges | Oui | Non |
| 30 | GET | /rest/v1/badges | Oui | Non |
| 31 | GET | /rest/v1/weekly_reports | Oui | **Oui** |
| 32 | GET | /functions/v1/seasonal-foods | Oui | Non |
| 33 | GET | /rest/v1/regions | Non | Non |
| 34 | GET | /rest/v1/subscriptions | Oui | Non |
| 35 | POST | /functions/v1/create-checkout-session | Oui | Non |
| 36 | POST | /functions/v1/cancel-subscription | Oui | Non |
| 37 | POST | /functions/v1/stripe-webhook | Non (sig) | Non |
| 38 | POST | /functions/v1/revenuecat-webhook | Non (sig) | Non |
| 39 | GET | /rest/v1/foods | Non | Non |
| 40 | GET | /rest/v1/food_categories | Non | Non |
| 41 | GET | /functions/v1/local-producers-link | Oui | Non |

**Total : 41 endpoints**

---

*Livrable 5 / 7 — Heal — Mai 2026*
