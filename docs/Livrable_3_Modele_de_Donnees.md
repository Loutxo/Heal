# Heal — Modèle de Données (ERD)

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)  
**Base de données :** PostgreSQL via Supabase  
**Hébergement :** Scaleway HDS (données de santé)

> **v1.1 — Changelog :** renommage Harméal → Heal ; ajout `tcm_nature`, `tcm_flavor`, `tcm_organ_affinity`, `basile_message_tcm` à `foods`. Pas de nouvelle table pour les producteurs locaux en v1 (redirection externe, cf. Livrable 1 US-034 et Livrable 5 §9).

---

## Conventions

- `PK` : Clé primaire
- `FK` : Clé étrangère
- `NOT NULL` : Champ obligatoire
- `UNIQUE` : Valeur unique dans la table
- `DEFAULT` : Valeur par défaut
- Types PostgreSQL utilisés : `uuid`, `text`, `integer`, `numeric`, `boolean`, `timestamp with time zone` (noté `timestamptz`), `date`, `jsonb`, `smallint`

---

## Vue d'ensemble des tables

```
AUTHENTIFICATION & COMPTES
├── auth.users (géré par Supabase Auth)
└── user_profiles

PROFIL & SANTÉ
├── user_health_data
├── user_restrictions
├── user_preferences
└── user_favorite_foods

DONNÉES DE RÉFÉRENCE (référentiels statiques)
├── foods
├── food_categories
├── food_nutrients
├── food_seasonality
└── regions

MENUS & PLANIFICATION
├── meal_plans
├── meals
└── meal_foods

BATCH COOKING
├── batch_cooking_guides
└── batch_tasks

LISTE DE COURSES
├── shopping_lists
└── shopping_list_items

VALIDATION DES REPAS
└── meal_validations

GAMIFICATION
├── user_points
├── user_streaks
├── badges
└── user_badges

RAPPORTS
└── weekly_reports

ABONNEMENTS
└── subscriptions

CONSENTEMENTS & LÉGAL
└── user_consents
```

---

## Détail des tables

---

### AUTHENTIFICATION & COMPTES

#### `auth.users` (Supabase Auth — géré automatiquement)
> Table native Supabase. Non modifiable directement.

| Colonne | Type | Description |
|---|---|---|
| `id` | `uuid` PK | Identifiant unique (référencé partout comme `user_id`) |
| `email` | `text` UNIQUE | Email de l'utilisateur |
| `created_at` | `timestamptz` | Date de création |
| `email_confirmed_at` | `timestamptz` | Date de confirmation email |

---

#### `user_profiles`
> Données publiques et générales de l'utilisateur (non sensibles).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK, FK → auth.users(id), ON DELETE CASCADE | |
| `first_name` | `text` | NOT NULL | Prénom |
| `region_id` | `integer` | FK → regions(id), NOT NULL | Région sélectionnée |
| `birth_date` | `date` | NOT NULL | Date de naissance |
| `sex` | `text` | NOT NULL, CHECK IN ('male','female','non_binary','undisclosed') | Sexe déclaré |
| `height_cm` | `smallint` | NOT NULL, CHECK (100–250) | Taille en cm |
| `weight_kg` | `numeric(5,2)` | NOT NULL, CHECK (30–300) | Poids en kg |
| `bmi` | `numeric(4,2)` | GENERATED (weight_kg / (height_cm/100)²) | IMC calculé automatiquement |
| `activity_level` | `text` | NOT NULL, CHECK IN ('sedentary','light','moderate','very_active') | Niveau d'activité |
| `fasting_protocol` | `text` | DEFAULT NULL, CHECK IN ('16_8','5_2') | Protocole jeûne intermittent actif |
| `fasting_window_start` | `time` | DEFAULT NULL | Début fenêtre alimentaire (16:8) |
| `fasting_window_end` | `time` | DEFAULT NULL | Fin fenêtre alimentaire (16:8) |
| `fasting_days` | `integer[]` | DEFAULT NULL | Jours de restriction (5:2 — 0=lundi, 6=dimanche) |
| `snack_enabled` | `boolean` | DEFAULT true | Collation quotidienne activée |
| `onboarding_completed` | `boolean` | DEFAULT false | Onboarding terminé |
| `trial_started_at` | `timestamptz` | DEFAULT NOW() | Début de la période d'essai |
| `locale` | `text` | DEFAULT 'fr', CHECK IN ('fr') | Langue de l'app (v1 : FR uniquement) |
| `created_at` | `timestamptz` | DEFAULT NOW() | |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

---

### PROFIL & SANTÉ

#### `user_health_data`
> Données de santé sensibles — hébergement HDS obligatoire, chiffrement at-rest.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, UNIQUE, ON DELETE CASCADE | |
| `pathologies` | `text[]` | DEFAULT '{}' | Liste des pathologies déclarées |
| `fasting_glucose` | `numeric(4,3)` | DEFAULT NULL, CHECK (0.3–5.0) | Glycémie à jeun (g/L) |
| `hba1c` | `numeric(4,2)` | DEFAULT NULL, CHECK (3.0–20.0) | HbA1c (%) |
| `total_cholesterol` | `numeric(4,3)` | DEFAULT NULL, CHECK (0.5–10.0) | Cholestérol total (g/L) |
| `triglycerides` | `numeric(4,3)` | DEFAULT NULL, CHECK (0.1–10.0) | Triglycérides (g/L) |
| `consent_given_at` | `timestamptz` | NOT NULL | Horodatage du consentement RGPD |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

**Valeurs possibles pour `pathologies[]` :**
```
'diabetes_type1', 'diabetes_type2', 'prediabetes', 'pcos',
'hypothyroidism', 'hypercholesterolemia', 'hypertriglyceridemia',
'celiac', 'crohn_ibd', 'none'
```

---

#### `user_restrictions`
> Allergies et préférences alimentaires.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, UNIQUE, ON DELETE CASCADE | |
| `allergies` | `text[]` | DEFAULT '{}' | Allergies déclarées |
| `diet_preferences` | `text[]` | DEFAULT '{}' | Préférences alimentaires |
| `disliked_foods` | `text[]` | DEFAULT '{}' | Aliments à éviter (saisie libre) |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

**Valeurs possibles pour `allergies[]` :**
```
'gluten', 'lactose', 'eggs', 'tree_nuts', 'peanuts', 'fish',
'shellfish', 'soy', 'sesame', 'celery', 'mustard', 'sulfites'
```

**Valeurs possibles pour `diet_preferences[]` :**
```
'vegetarian', 'vegan', 'halal', 'kosher', 'no_pork', 'no_alcohol_cooking'
```

---

#### `user_favorite_foods`
> Aliments préférés déclarés à l'onboarding.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `food_id` | `integer` | FK → foods(id), NOT NULL | |
| `created_at` | `timestamptz` | DEFAULT NOW() | |

---

### DONNÉES DE RÉFÉRENCE (référentiels statiques)

#### `regions`
> Régions géographiques supportées pour la saisonnalité.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `integer` | PK GENERATED ALWAYS AS IDENTITY | |
| `name` | `text` | NOT NULL, UNIQUE | Nom affiché (ex : "Île-de-France") |
| `country` | `text` | NOT NULL | Code pays ISO (ex : 'FR', 'BE', 'ES') |
| `slug` | `text` | NOT NULL, UNIQUE | Identifiant URL (ex : 'ile-de-france') |
| `climate_zone` | `text` | NOT NULL, CHECK IN ('oceanic','continental','mediterranean','mountain') | Zone climatique (influe sur les saisons) |

---

#### `food_categories`
> Catégories d'aliments pour l'organisation de la liste de courses.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `integer` | PK GENERATED ALWAYS AS IDENTITY | |
| `name` | `text` | NOT NULL, UNIQUE | Ex : "Légumes", "Fruits", "Viandes" |
| `shopping_section` | `text` | NOT NULL | Section liste de courses : 'produce', 'proteins', 'dairy', 'dry_goods', 'herbs_spices' |
| `icon` | `text` | NOT NULL | Emoji ou nom d'icône |
| `sort_order` | `smallint` | NOT NULL | Ordre d'affichage |

---

#### `foods`
> Base de données des aliments.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `integer` | PK GENERATED ALWAYS AS IDENTITY | |
| `name` | `text` | NOT NULL | Nom de l'aliment |
| `name_variants` | `text[]` | DEFAULT '{}' | Variantes orthographiques / synonymes |
| `category_id` | `integer` | FK → food_categories(id), NOT NULL | |
| `glycemic_index` | `smallint` | CHECK (0–100) | Index glycémique (NULL si non applicable) |
| `glycemic_load_per_100g` | `numeric(5,2)` | | Charge glycémique pour 100g |
| `is_allergen` | `boolean` | DEFAULT false | Est lui-même un allergène |
| `allergen_tags` | `text[]` | DEFAULT '{}' | Allergènes contenus (ex : ['gluten']) |
| `diet_compatibility` | `text[]` | DEFAULT '{}' | Compatible avec : ['vegetarian','vegan','halal','kosher'] |
| `is_local` | `boolean` | DEFAULT true | Produit localement en France / pays limitrophes |
| `storage_days_fridge` | `smallint` | | Durée conservation au frigo après préparation (jours) |
| `unit_default` | `text` | NOT NULL, DEFAULT 'g' | Unité par défaut : 'g', 'ml', 'unit' |
| `unit_concrete_label` | `text` | | Ex : "1 carotte moyenne = 80g" |
| `health_benefits` | `text[]` | DEFAULT '{}' | Tags bénéfices : ['omega3','antioxidant','collagen','fiber','vitamin_c'…] |
| `tcm_nature` | `text` | DEFAULT NULL, CHECK IN ('cold','cool','neutral','warm','hot') | Nature énergétique en diététique traditionnelle chinoise |
| `tcm_flavor` | `text[]` | DEFAULT '{}' | Saveur(s) MTC : ['sour','bitter','sweet','pungent','salty'] (un aliment peut avoir plusieurs saveurs) |
| `tcm_organ_affinity` | `text[]` | DEFAULT '{}' | Élément/organe associé (optionnel, pour messages Basile) : ['liver','heart','spleen','lung','kidney'] |
| `basile_message` | `text` | | Message éducatif de Basile sur cet aliment (nutrition occidentale) |
| `basile_message_tcm` | `text` | DEFAULT NULL | Message éducatif optionnel de Basile sur cet aliment (angle diététique chinoise) |
| `is_active` | `boolean` | DEFAULT true | Aliment utilisable dans la génération |
| `created_at` | `timestamptz` | DEFAULT NOW() | |

**Note d'implémentation MTC (Product Brief §8) :** `tcm_nature`/`tcm_flavor` influencent la génération de menus comme un **nudge léger** (préférence à égalité de règles occidentales), jamais comme un filtre d'exclusion — seules les règles IG/CG/allergies/pathologies (déjà en place) peuvent exclure un aliment.

---

#### `food_nutrients`
> Valeurs nutritionnelles pour 100g (table séparée pour ne pas alourdir foods).

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `food_id` | `integer` | PK, FK → foods(id), ON DELETE CASCADE | |
| `energy_kcal` | `numeric(6,2)` | | Énergie (kcal/100g) |
| `proteins_g` | `numeric(5,2)` | | Protéines (g/100g) |
| `carbs_g` | `numeric(5,2)` | | Glucides totaux (g/100g) |
| `sugars_g` | `numeric(5,2)` | | dont Sucres (g/100g) |
| `fat_g` | `numeric(5,2)` | | Lipides (g/100g) |
| `saturated_fat_g` | `numeric(5,2)` | | dont Acides gras saturés (g/100g) |
| `fiber_g` | `numeric(5,2)` | | Fibres (g/100g) |
| `omega3_g` | `numeric(5,3)` | | Oméga-3 (g/100g) |
| `vitamin_c_mg` | `numeric(6,2)` | | Vitamine C (mg/100g) |
| `iron_mg` | `numeric(5,2)` | | Fer (mg/100g) |
| `calcium_mg` | `numeric(6,2)` | | Calcium (mg/100g) |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

---

#### `food_seasonality`
> Disponibilité saisonnière d'un aliment par région et par mois.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `integer` | PK GENERATED ALWAYS AS IDENTITY | |
| `food_id` | `integer` | FK → foods(id), NOT NULL | |
| `region_id` | `integer` | FK → regions(id), NOT NULL | |
| `months_available` | `smallint[]` | NOT NULL, CHECK (1–12) | Mois de disponibilité (1=janv, 12=déc) |
| UNIQUE | | (food_id, region_id) | Un enregistrement par aliment × région |

---

### MENUS & PLANIFICATION

#### `meal_plans`
> Planning hebdomadaire par utilisateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `week_start` | `date` | NOT NULL | Lundi de la semaine (toujours un lundi) |
| `status` | `text` | NOT NULL, DEFAULT 'active', CHECK IN ('active','archived') | |
| `generation_params` | `jsonb` | NOT NULL | Snapshot des paramètres utilisés pour générer (profil, restrictions, saison…) |
| `available_foods` | `integer[]` | DEFAULT '{}' | IDs des aliments disponibles déclarés avant génération |
| `created_at` | `timestamptz` | DEFAULT NOW() | |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |
| UNIQUE | | (user_id, week_start) | Un seul planning actif par semaine par utilisateur |

---

#### `meals`
> Repas individuels composant un planning.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `meal_plan_id` | `uuid` | FK → meal_plans(id), NOT NULL, ON DELETE CASCADE | |
| `meal_date` | `date` | NOT NULL | Date du repas |
| `meal_type` | `text` | NOT NULL, CHECK IN ('breakfast','lunch','snack','dinner') | Type de repas |
| `name` | `text` | NOT NULL | Nom du repas (ex : "Saumon aux lentilles corail") |
| `estimated_glycemic_load` | `numeric(5,2)` | | Charge glycémique estimée du repas complet |
| `glycemic_level` | `text` | NOT NULL, CHECK IN ('low','moderate','high') | Niveau glycémique simplifié |
| `eating_order` | `text[]` | NOT NULL | Ordre de consommation conseillé |
| `estimated_prep_time_min` | `smallint` | | Temps de préparation actif (min) |
| `swap_count` | `smallint` | DEFAULT 0 | Nombre de swaps effectués sur ce repas |
| `is_validated` | `boolean` | DEFAULT false | Le repas a été consommé et validé |
| `created_at` | `timestamptz` | DEFAULT NOW() | |

---

#### `meal_foods`
> Aliments composant un repas avec quantités personnalisées.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `meal_id` | `uuid` | FK → meals(id), NOT NULL, ON DELETE CASCADE | |
| `food_id` | `integer` | FK → foods(id), NOT NULL | |
| `quantity_g` | `numeric(7,2)` | NOT NULL | Quantité en grammes (personnalisée selon profil) |
| `quantity_concrete` | `text` | | Description concrète (ex : "2 carottes moyennes") |
| `is_out_of_season` | `boolean` | DEFAULT false | Aliment hors saison (provient des disponibles déclarés) |
| `sort_order` | `smallint` | NOT NULL | Ordre d'affichage dans le repas |

---

### BATCH COOKING

#### `batch_cooking_guides`
> Guide de préparation généré par semaine.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `meal_plan_id` | `uuid` | FK → meal_plans(id), NOT NULL, UNIQUE, ON DELETE CASCADE | |
| `weekend_estimated_active_min` | `smallint` | | Durée estimée préparation active week-end |
| `weekend_estimated_passive_min` | `smallint` | | Durée estimée cuissons passives |
| `basile_tip` | `text` | | Conseil d'organisation de Basile |
| `created_at` | `timestamptz` | DEFAULT NOW() | |

---

#### `batch_tasks`
> Tâches individuelles du guide batch cooking.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `guide_id` | `uuid` | FK → batch_cooking_guides(id), NOT NULL, ON DELETE CASCADE | |
| `guide_type` | `text` | NOT NULL, CHECK IN ('weekend','daily') | Week-end ou quotidien |
| `task_date` | `date` | DEFAULT NULL | Date de la tâche (pour les tâches quotidiennes) |
| `task_category` | `text` | NOT NULL, CHECK IN ('passive_cooking','active_cooking','cutting','marinade','sauce_base','assembly') | Catégorie de tâche |
| `description` | `text` | NOT NULL | Description de la tâche |
| `foods_involved` | `text[]` | DEFAULT '{}' | Aliments concernés |
| `estimated_duration_min` | `smallint` | | Durée estimée (min) |
| `sort_order` | `smallint` | NOT NULL | Ordre logique d'exécution |
| `is_completed` | `boolean` | DEFAULT false | Tâche cochée par l'utilisateur |

---

### LISTE DE COURSES

#### `shopping_lists`
> Liste de courses par semaine.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `meal_plan_id` | `uuid` | FK → meal_plans(id), NOT NULL, UNIQUE, ON DELETE CASCADE | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL | (dénormalisé pour accès direct) |
| `created_at` | `timestamptz` | DEFAULT NOW() | |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

---

#### `shopping_list_items`
> Articles de la liste de courses.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `shopping_list_id` | `uuid` | FK → shopping_lists(id), NOT NULL, ON DELETE CASCADE | |
| `food_id` | `integer` | FK → foods(id), DEFAULT NULL | NULL si article ajouté manuellement |
| `name` | `text` | NOT NULL | Nom de l'article |
| `total_quantity_g` | `numeric(8,2)` | | Quantité totale consolidée (g) |
| `quantity_label` | `text` | NOT NULL | Ex : "450g — environ 6 carottes" |
| `shopping_section` | `text` | NOT NULL | Section du rayon (repris de food_categories) |
| `is_checked` | `boolean` | DEFAULT false | Article coché (acheté) |
| `is_manual` | `boolean` | DEFAULT false | Ajouté manuellement par l'utilisateur |
| `is_seasonal` | `boolean` | DEFAULT true | Aliment de saison |
| `sort_order` | `smallint` | NOT NULL | Ordre dans la liste |

---

### VALIDATION DES REPAS

#### `meal_validations`
> Historique des repas consommés par l'utilisateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `meal_id` | `uuid` | FK → meals(id), DEFAULT NULL | NULL si repas libre (non planifié) |
| `validated_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |
| `validation_method` | `text` | NOT NULL, CHECK IN ('one_click','photo','text_search') | Méthode de validation |
| `photo_url` | `text` | DEFAULT NULL | URL de la photo (Supabase Storage) si méthode photo |
| `detected_foods` | `jsonb` | DEFAULT NULL | Aliments détectés par l'IA (photo/texte) avec quantités |
| `nutritional_score` | `numeric(4,2)` | NOT NULL | Score nutritionnel calculé (0–100) |
| `glycemic_load_actual` | `numeric(5,2)` | DEFAULT NULL | Charge glycémique réelle (si repas différent du plan) |
| `points_earned` | `smallint` | NOT NULL | Points attribués pour ce repas |
| `basile_message_id` | `integer` | FK → basile_messages(id) | Message affiché |

---

### GAMIFICATION

#### `user_points`
> Solde et historique des points.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, UNIQUE, ON DELETE CASCADE | |
| `total_points` | `integer` | NOT NULL, DEFAULT 0 | Total cumulé |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

---

#### `points_history`
> Détail des mouvements de points.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `points` | `smallint` | NOT NULL | Points gagnés (positif uniquement en v1) |
| `source` | `text` | NOT NULL, CHECK IN ('meal_validation','streak_bonus','badge_unlock','onboarding') | |
| `reference_id` | `uuid` | DEFAULT NULL | ID de la validation / badge concerné |
| `earned_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |

---

#### `user_streaks`
> Suivi du streak journalier.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `user_id` | `uuid` | PK, FK → auth.users(id), ON DELETE CASCADE | |
| `current_streak` | `smallint` | NOT NULL, DEFAULT 0 | Streak actuel (jours consécutifs) |
| `max_streak` | `smallint` | NOT NULL, DEFAULT 0 | Record personnel |
| `last_active_date` | `date` | DEFAULT NULL | Dernier jour avec streak validé |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

---

#### `badges`
> Référentiel des badges disponibles.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `integer` | PK GENERATED ALWAYS AS IDENTITY | |
| `slug` | `text` | NOT NULL, UNIQUE | Identifiant technique (ex : 'first_meal') |
| `name` | `text` | NOT NULL | Nom affiché (ex : "Premier Repas") |
| `description` | `text` | NOT NULL | Description de la condition d'obtention |
| `icon` | `text` | NOT NULL | Emoji ou nom d'asset |
| `unlock_condition` | `jsonb` | NOT NULL | Condition structurée (évaluée par une Edge Function) |
| `points_reward` | `smallint` | NOT NULL, DEFAULT 0 | Points bonus à l'obtention |
| `sort_order` | `smallint` | NOT NULL | Ordre d'affichage |

---

#### `user_badges`
> Badges débloqués par utilisateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `badge_id` | `integer` | FK → badges(id), NOT NULL | |
| `unlocked_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |
| UNIQUE | | (user_id, badge_id) | Un badge débloqué une seule fois |

---

#### `basile_messages`
> Bibliothèque des messages d'encouragement de Basile.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `integer` | PK GENERATED ALWAYS AS IDENTITY | |
| `context` | `text` | NOT NULL, CHECK IN ('meal_validation','streak','badge','report','onboarding','warning') | Contexte d'affichage |
| `food_tag` | `text` | DEFAULT NULL | Aliment spécifique concerné (ex : 'lentils') |
| `health_benefit_tag` | `text` | DEFAULT NULL | Bénéfice mis en avant (ex : 'omega3', 'fiber') |
| `message_text` | `text` | NOT NULL | Texte du message |
| `min_points` | `smallint` | DEFAULT 0 | Points minimum suggérés avec ce message |
| `max_points` | `smallint` | DEFAULT 20 | Points maximum suggérés |

---

### RAPPORTS

#### `weekly_reports`
> Rapport hebdomadaire généré automatiquement.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `meal_plan_id` | `uuid` | FK → meal_plans(id), NOT NULL | |
| `week_start` | `date` | NOT NULL | Lundi de la semaine couverte |
| `meals_validated` | `smallint` | NOT NULL | Nombre de repas validés |
| `meals_total` | `smallint` | NOT NULL | Nombre de repas possibles |
| `glycemic_score` | `numeric(4,2)` | NOT NULL | Score glycémique estimé (0–100) |
| `glycemic_level` | `text` | NOT NULL, CHECK IN ('low','moderate','high') | |
| `food_diversity_score` | `smallint` | NOT NULL | Nombre de familles d'aliments différents |
| `top_meals` | `uuid[]` | | IDs des 3 meilleurs repas de la semaine |
| `basile_advice` | `text` | NOT NULL | Conseil personnalisé de Basile |
| `generated_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |
| UNIQUE | | (user_id, week_start) | Un rapport par semaine par utilisateur |

---

### ABONNEMENTS

#### `subscriptions`
> État de l'abonnement utilisateur.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, UNIQUE, ON DELETE CASCADE | |
| `status` | `text` | NOT NULL, CHECK IN ('trial','active','past_due','canceled','expired') | |
| `plan` | `text` | DEFAULT NULL, CHECK IN ('monthly','annual') | NULL pendant l'essai |
| `trial_ends_at` | `timestamptz` | NOT NULL | Date de fin d'essai |
| `current_period_start` | `timestamptz` | DEFAULT NULL | Début de la période payante |
| `current_period_end` | `timestamptz` | DEFAULT NULL | Fin de la période payante |
| `stripe_customer_id` | `text` | DEFAULT NULL | ID client Stripe |
| `stripe_subscription_id` | `text` | DEFAULT NULL | ID abonnement Stripe |
| `revenuecat_user_id` | `text` | DEFAULT NULL | ID RevenueCat (mobile) |
| `canceled_at` | `timestamptz` | DEFAULT NULL | Date de résiliation |
| `created_at` | `timestamptz` | DEFAULT NOW() | |
| `updated_at` | `timestamptz` | DEFAULT NOW() | |

---

### CONSENTEMENTS & LÉGAL

#### `user_consents`
> Historique des consentements RGPD.

| Colonne | Type | Contraintes | Description |
|---|---|---|---|
| `id` | `uuid` | PK DEFAULT gen_random_uuid() | |
| `user_id` | `uuid` | FK → auth.users(id), NOT NULL, ON DELETE CASCADE | |
| `consent_type` | `text` | NOT NULL, CHECK IN ('health_data','marketing','terms') | |
| `given` | `boolean` | NOT NULL | Consentement donné (true) ou refusé (false) |
| `version` | `text` | NOT NULL | Version du document accepté (ex : 'cgu_v1.2') |
| `ip_address` | `inet` | | IP de l'appareil (pseudonymisée) |
| `user_agent` | `text` | | User agent du navigateur / app |
| `consented_at` | `timestamptz` | NOT NULL, DEFAULT NOW() | |

---

## Index recommandés

```sql
-- Accès fréquents par user_id
CREATE INDEX idx_meal_plans_user_id ON meal_plans(user_id);
CREATE INDEX idx_meals_meal_plan_id ON meals(meal_plan_id);
CREATE INDEX idx_meal_validations_user_id ON meal_validations(user_id);
CREATE INDEX idx_points_history_user_id ON points_history(user_id);
CREATE INDEX idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX idx_weekly_reports_user_id ON weekly_reports(user_id);

-- Accès fréquents par semaine
CREATE INDEX idx_meal_plans_week_start ON meal_plans(week_start);
CREATE INDEX idx_meals_meal_date ON meals(meal_date);

-- Saisonnalité : requêtes food × region × month
CREATE INDEX idx_food_seasonality_food_region ON food_seasonality(food_id, region_id);

-- Génération de menus : filtres multi-critères sur foods
CREATE INDEX idx_foods_category_id ON foods(category_id);
CREATE INDEX idx_foods_glycemic_index ON foods(glycemic_index);
CREATE INDEX idx_foods_is_active ON foods(is_active);
```

---

## Politique de Row Level Security (RLS) Supabase

```sql
-- Un utilisateur ne peut voir et modifier que SES propres données
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_health_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_validations ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
-- (idem pour toutes les tables contenant user_id)

-- Exemple de policy
CREATE POLICY "Users can only access their own data"
ON user_profiles FOR ALL
USING (auth.uid() = id);
```

---

## Données de référence à peupler (seed)

| Table | Volume estimé |
|---|---|
| `regions` | ~20 entrées |
| `food_categories` | ~10 entrées |
| `foods` | ~300–500 aliments, incl. `tcm_nature`/`tcm_flavor` renseignés (source : tables de diététique chinoise classiques) |
| `food_nutrients` | ~300–500 entrées |
| `food_seasonality` | ~3 000–5 000 entrées (aliments × régions × mois) |
| `badges` | 10 entrées (v1) |
| `basile_messages` | ~100 messages, dont ~25 à angle MTC (`basile_message_tcm`) |

---

*Livrable 3 / 7 — Heal — Mai 2026*
