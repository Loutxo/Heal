# Heal — Plan de Tests

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)

> **v1.1 — Changelog :** renommage Harméal → Heal ; tests ajoutés pour le nudge MTC (§1.2, §2.3) et le lien producteurs locaux (§2.4).

---

## Stratégie de test

### Pyramide de tests

```
         /\
        /E2E\         ← Peu nombreux, couvrent les parcours critiques
       /------\
      / Intégr.\      ← Tests API + BDD (endpoints + règles métier)
     /----------\
    /   Unitaire  \   ← Tests de logique pure (calculs, règles, formatage)
   /--------------\
```

| Niveau | Volume | Outil | Déclenchement |
|---|---|---|---|
| Unitaires | ~200 tests | **Jest** + TypeScript | À chaque commit |
| Intégration | ~80 tests | **Jest** + Supabase local | À chaque PR |
| E2E | ~30 scénarios | **Detox** (mobile) + **Playwright** (web) | Avant déploiement staging |
| Manuel / UAT | Checklists | — | Avant chaque release |

---

## 1. Tests Unitaires

> Testent des fonctions pures isolées, sans dépendances externes (BDD, API).

---

### 1.1 Calculs nutritionnels

#### `calculateBMI(weightKg, heightCm): number`
```
✓ Cas normal : 70kg, 175cm → 22.86
✓ Surpoids : 85kg, 170cm → 29.41
✓ Obésité : 100kg, 165cm → 36.73
✓ Poids insuffisant : 50kg, 170cm → 17.30
✗ Taille = 0 → throw Error
✗ Poids négatif → throw Error
```

#### `calculateBMR(weightKg, heightCm, ageYears, sex): number`
> Formule Harris-Benedict révisée (Mifflin-St Jeor)
```
✓ Homme 35 ans, 80kg, 180cm → 1 869 kcal
✓ Femme 45 ans, 65kg, 165cm → 1 387 kcal
✓ Non-binaire → moyenne homme/femme
✓ Âge 16 ans (limite basse) → valeur correcte
✓ Âge 100 ans (limite haute) → valeur correcte
```

#### `calculateTDEE(bmr, activityLevel): number`
```
✓ Sédentaire → BMR × 1.2
✓ Légèrement actif → BMR × 1.375
✓ Modérément actif → BMR × 1.55
✓ Très actif → BMR × 1.725
✗ Niveau inconnu → throw Error
```

#### `calculateMealGlycemicLoad(foods: MealFood[]): number`
> CG = (IG × quantité_glucides_g) / 100
```
✓ Repas simple : riz blanc 80g (IG=72, glucides=28g/100g) → CG = (72×22.4)/100 = 16.1
✓ Repas mixte : riz + légumes + poulet → somme des CG individuelles
✓ Aliment sans IG (huile d'olive) → CG = 0 (ignoré)
✓ Repas vide → 0
```

#### `calculateNutritionalScore(foods: MealFood[]): number`
```
✓ Repas avec légumes + protéines + légumineuses → score élevé (>70)
✓ Repas de pizza blanche → score bas (<40)
✓ Bonus fibres (>5g) → +10 points
✓ Bonus oméga-3 (poisson gras) → +15 points
✓ Pénalité graisses saturées (>7g) → -10 points
✓ Score toujours entre 0 et 100
```

---

### 1.2 Règles de génération de menus

#### `applyPathologyRules(pathologies, menuConstraints): MenuConstraints`
```
✓ Diabète T2 → IG max = 40, CG journalière max = 80g
✓ Hypothyroïdie → choux crus exclus de la liste des aliments
✓ Hypercholestérolémie → graisses saturées max = 7% des calories
✓ Maladie cœliaque → tous les aliments contenant 'gluten' exclus
✓ Crohn → fibres insolubles limitées
✓ Aucune pathologie → contraintes standard
✓ Combinaison diabète + hypercholestérolémie → les deux règles appliquées
```

#### `applyAllergyFilter(foods, allergies): Food[]`
```
✓ Allergie gluten → tous les aliments avec allergen_tags contenant 'gluten' supprimés
✓ Vegan → tous les produits animaux supprimés (viande, poisson, lait, œufs, miel)
✓ Végétarien → viandes et poissons supprimés, œufs et produits laitiers conservés
✓ Vegan ⊃ Végétarien → vegan plus restrictif que végétarien
✓ Aucune allergie → liste inchangée
✗ Allergie vers un aliment non existant → liste inchangée (pas d'erreur)
```

#### `isFoodInSeason(foodId, regionId, month): boolean`
```
✓ Asperges, Île-de-France, mai → true
✓ Asperges, Île-de-France, décembre → false
✓ Tomate, PACA, juillet → true
✓ Tomate, Île-de-France, janvier → false
✓ Aliment sans données de saison → false (conservatif)
```

#### `hasMealDuplicateInWeek(mealName, weekMeals, mealType): boolean`
```
✓ "Saumon aux lentilles" présent le lundi soir → true si proposé le jeudi soir
✓ "Porridge avoine" présent lundi matin → true si proposé mercredi matin (exception breakfast)
  [Note : petits-déj et collations PEUVENT se répéter]
✓ "Porridge avoine" présent lundi matin → false (autorisé de se répéter)
✓ Repas différent → false
```

#### `applyTcmSeasonalNudge(candidateFoods, month): Food[]`
> Nudge léger — ne doit jamais exclure un aliment, seulement réordonner/pondérer les candidats déjà valides
```
✓ Hiver → aliments tcm_nature='warm'/'hot' légèrement favorisés parmi les candidats valides
✓ Été → aliments tcm_nature='cool'/'cold' légèrement favorisés parmi les candidats valides
✓ Aucun aliment favori disponible pour la saison → liste inchangée (pas d'erreur, pas de vide)
✓ Un aliment sans tcm_nature renseigné → traité comme neutre, ni favorisé ni pénalisé
✓ Le nudge ne fait jamais sortir un aliment déjà exclu par applyPathologyRules/applyAllergyFilter
```

---

### 1.3 Calculs du streak

#### `updateStreak(lastActiveDate, today): { current, max }`
```
✓ Pas de streak → lastActiveDate null → current = 0
✓ Hier = dernier jour actif → current + 1
✓ Avant-hier = dernier jour actif → current = 1 (reset)
✓ Aujourd'hui = dernier jour actif → current inchangé (pas de double comptage)
✓ Nouveau max → max mis à jour
✓ Reset sous le max → max conservé
```

#### `isDayComplete(validations: MealValidation[], date): boolean`
> Un jour est complet si au moins 2 repas principaux sont validés
```
✓ Déjeuner + Dîner validés → true
✓ Petit-déj + Déjeuner validés → true
✓ Déjeuner seul → false
✓ Collation seule → false
✓ 3 repas validés → true
✓ Aucun repas → false
```

---

### 1.4 Formatage et utilitaires

#### `formatQuantityConcrete(quantityG, food): string`
```
✓ 80g de carottes → "80g — environ 1 carotte"
✓ 240g de carottes → "240g — environ 3 carottes"
✓ 150g de saumon → "150g — 1 portion"
✓ 15ml d'huile d'olive → "15ml — 1 cuillère à soupe"
✓ Aliment sans équivalent concret → "80g" uniquement
```

#### `getGlycemicLevel(glycemicLoad): 'low' | 'moderate' | 'high'`
```
✓ CG ≤ 10 → 'low'
✓ CG 11–19 → 'moderate'
✓ CG ≥ 20 → 'high'
✓ CG = 10 (limite basse) → 'low'
✓ CG = 20 (limite haute) → 'high'
```

---

## 2. Tests d'Intégration

> Testent les endpoints API contre une instance Supabase locale (Supabase CLI).  
> Chaque test commence avec une BDD vide + seed de référence.

---

### 2.1 Authentification

| Test | Attendu |
|---|---|
| Inscription email valide | 200 + email de confirmation |
| Inscription email existant | 409 Conflict |
| Inscription mot de passe faible | 400 Bad Request |
| Connexion identifiants corrects | 200 + JWT valide |
| Connexion mot de passe incorrect | 400 |
| Connexion après 5 tentatives échouées | 429 (rate limit 15 min) |
| Refresh token valide | 200 + nouveau JWT |
| Refresh token expiré | 401 |
| Suppression compte — mot de passe correct | 200 + données supprimées en BDD |
| Suppression compte — mot de passe incorrect | 401 |

---

### 2.2 Profil & Données de santé

| Test | Attendu |
|---|---|
| GET profil de l'utilisateur connecté | 200 + données correctes |
| GET profil d'un autre utilisateur | 404 (RLS) |
| PATCH poids valide (67.5) | 200 |
| PATCH poids invalide (500) | 400 |
| PATCH taille invalide (50) | 400 |
| PUT données santé avec consentement | 200 |
| PUT données santé sans consentement | 400 |
| PUT glycémie hors plage (50) | 400 |
| GET données santé d'un autre utilisateur | 403 (RLS HDS) |

---

### 2.3 Génération de menus

| Test | Attendu |
|---|---|
| Génération planning semaine (utilisateur avec essai actif) | 200 + 28 repas créés |
| Génération — utilisateur sans essai actif | 403 |
| Génération — semaine déjà existante (sans force_regenerate) | 409 |
| Génération — semaine déjà existante (avec force_regenerate) | 200 + ancien planning archivé |
| Génération — utilisateur végétalien | 200 + aucun aliment animal dans les repas |
| Génération — allergie gluten | 200 + aucun aliment contenant gluten |
| Génération — diabète T2 | 200 + IG max ≤ 40 sur tous les repas |
| Génération — pas de doublon repas sur la semaine (déjeuner/dîner) | 200 + vérification unicité |
| Génération — petits-déjeuners peuvent se répéter | 200 + doublons acceptés sur breakfast |
| Génération en hiver — nudge MTC actif | 200 + légère préférence aliments tcm_nature warm/hot, aucune exclusion |
| Génération — nudge MTC ne contredit jamais une règle occidentale | 200 + un aliment exclu par allergie/pathologie reste exclu même si sa nature MTC est favorable à la saison |
| Swap repas — 1ère tentative | 200 + nouveau repas différent de l'original |
| Swap repas — repas validé | 403 |
| Swap repas — 4ème tentative (max dépassé) | 400 |

---

### 2.4 Liste de courses

| Test | Attendu |
|---|---|
| GET liste après génération planning | 200 + articles consolidés par catégorie |
| Cocher un article | 200 + is_checked = true |
| Décocher un article | 200 + is_checked = false |
| Ajouter un article manuel | 201 + article avec is_manual = true |
| Supprimer un article | 204 |
| GET liste d'un autre utilisateur | 403 (RLS) |
| Export liste (articles non cochés) | 200 + texte formaté sans articles cochés |
| GET /local-producers-link — région connue | 200 + au moins une ressource retournée |
| GET /local-producers-link — région sans ressource configurée | 200 + liste vide (pas d'erreur) |

---

### 2.5 Validation des repas

| Test | Attendu |
|---|---|
| Validation 1 clic — repas non validé | 200 + points crédités + streak mis à jour |
| Validation 1 clic — repas déjà validé | 409 |
| Validation 1 clic — repas passé > 24h | 422 |
| Validation texte — aliments valides | 200 + score calculé |
| Validation texte — allergène détecté | 200 + warning (non bloquant) |
| Validation — vérification badge débloqué | 200 + badge si condition atteinte |
| Validation — streak incrémenté si jour complet | streak + 1 si ≥ 2 repas validés |
| Validation — streak non incrémenté si jour incomplet | streak inchangé si < 2 repas |

---

### 2.6 Abonnement

| Test | Attendu |
|---|---|
| GET statut — essai actif (J+5) | status = 'trial', trial_ends_at dans le futur |
| GET statut — essai expiré | status = 'expired' |
| Accès planning — essai actif | 200 |
| Accès planning — essai expiré | 403 |
| Webhook Stripe checkout.session.completed | status → 'active', plan = 'monthly' |
| Webhook Stripe invoice.payment_failed | status → 'past_due' |
| Webhook Stripe customer.subscription.deleted | status → 'canceled' |
| Résiliation abonnement | canceled_at renseigné, accès jusqu'à period_end |

---

### 2.7 Gamification

| Test | Attendu |
|---|---|
| Points après validation 1 clic (repas conforme) | +15 points |
| Points après validation photo (bon score) | +10–15 points |
| Points bonus streak 3 jours | +5 points au 3ème jour |
| Points bonus streak 7 jours | +10 points au 7ème jour |
| Badge "Premier Repas" — première validation | Badge débloqué |
| Badge "Premier Repas" — deuxième validation | Pas de doublon |
| Badge "Semaine parfaite" — 7 jours × 3 repas | Badge débloqué dimanche soir |
| Rapport hebdomadaire — généré dimanche 20h | Rapport créé avec scores corrects |

---

## 3. Tests End-to-End (E2E)

> Simulent un utilisateur réel sur l'application. Environnement staging.

---

### Scénario E2E-01 — Première utilisation complète
```
GIVEN Un nouveau visiteur ouvre l'app pour la première fois
WHEN  Il parcourt le Welcome, crée un compte, confirme son email
AND   Il complète l'onboarding (toutes les étapes)
THEN  L'écran de bienvenue Basile s'affiche
AND   Un planning semaine est généré automatiquement
AND   Une liste de courses est disponible
AND   Le guide batch cooking est accessible
```

---

### Scénario E2E-02 — Parcours quotidien nominal
```
GIVEN Un utilisateur abonné avec un planning actif
WHEN  Il ouvre l'app le soir
AND   Il tape "J'ai mangé ça ✓" sur le repas du dîner
THEN  La modale Basile s'affiche avec un message personnalisé
AND   Les points sont crédités immédiatement
AND   Le streak est incrémenté si c'est le 2ème repas du jour
```

---

### Scénario E2E-03 — Repas différent du menu (photo)
```
GIVEN Un utilisateur abonné
WHEN  Il ouvre le détail d'un repas
AND   Il choisit "Valider par photo"
AND   Il prend une photo de son repas
THEN  L'IA détecte les aliments (liste affichée)
WHEN  Il confirme les aliments détectés
THEN  Un score nutritionnel est calculé
AND   Les points correspondants sont crédités
AND   La modale Basile s'affiche
```

---

### Scénario E2E-04 — Gestion de la liste de courses
```
GIVEN Un utilisateur avec un planning semaine actif
WHEN  Il ouvre la liste de courses
THEN  Les articles sont organisés par catégorie
WHEN  Il coche "Carottes"
THEN  L'article est grisé et déplacé en bas
WHEN  Il ajoute "Tahini" manuellement
THEN  L'article apparaît avec un badge "ajout manuel"
WHEN  Il exporte la liste
THEN  Un texte sans les articles cochés est disponible à partager
```

---

### Scénario E2E-05 — Batch cooking week-end
```
GIVEN Un utilisateur avec un planning actif (dimanche)
WHEN  Il ouvre le guide batch cooking week-end
THEN  Les tâches passives apparaissent en premier
AND   La durée active estimée est affichée
WHEN  Il coche "Lancer le mijoté au four"
THEN  La tâche passe en état complété
WHEN  Il coche toutes les tâches
THEN  Basile affiche un message de félicitations
```

---

### Scénario E2E-06 — Fin d'essai et abonnement
```
GIVEN Un utilisateur dont l'essai expire aujourd'hui
WHEN  Il ouvre l'app
THEN  L'écran Paywall s'affiche
WHEN  Il sélectionne l'offre annuelle
AND   Il complète le paiement (test Stripe)
THEN  L'abonnement est activé immédiatement
AND   Il est redirigé vers son planning
AND   L'accès à toutes les fonctionnalités est rétabli
```

---

### Scénario E2E-07 — Swap de repas
```
GIVEN Un utilisateur abonné avec un planning actif
WHEN  Il ouvre le détail d'un repas
AND   Il tape "Remplacer ce repas"
THEN  Une animation de chargement de Basile s'affiche
AND   Un nouveau repas est proposé (différent de l'original)
AND   Le nouveau repas respecte toutes les allergies et la saison
WHEN  Il accepte la proposition
THEN  Le planning est mis à jour avec le nouveau repas
AND   La liste de courses est recalculée
```

---

### Scénario E2E-08 — Suppression de compte (RGPD)
```
GIVEN Un utilisateur avec un profil complet et un historique
WHEN  Il va dans Paramètres → Supprimer mon compte
AND   Il confirme avec son mot de passe
THEN  Un message de confirmation s'affiche
AND   Il est déconnecté immédiatement
AND   Ses données ne sont plus accessibles via l'API
```

---

### Scénario E2E-09 — Utilisateur diabétique
```
GIVEN Un utilisateur avec pathologie "Diabète de type 2" déclarée
WHEN  Un planning est généré
THEN  Aucun repas n'a un IG moyen > 40
AND   La charge glycémique journalière estimée est ≤ 80g
AND   Chaque repas affiche l'ordre légumes → protéines → féculents
```

---

### Scénario E2E-10 — Rapport hebdomadaire
```
GIVEN Un utilisateur ayant validé 20+ repas sur la semaine
WHEN  Le dimanche 20h arrive (simulé en staging)
THEN  Une notification push est envoyée
WHEN  Il ouvre la notification
THEN  Le rapport de la semaine s'affiche avec :
      - Score glycémique estimé
      - Repas validés (ex : 22/28)
      - Top 3 repas de la semaine
      - Conseil de Basile pour la semaine prochaine
```

---

## 4. Tests de Sécurité

| Test | Méthode | Attendu |
|---|---|---|
| Accès aux données d'un autre utilisateur | GET /user_profiles avec JWT d'un autre utilisateur | 404 (RLS) |
| Accès données santé sans auth | GET /user_health_data sans JWT | 401 |
| Injection SQL via paramètre | `name=ilike.*; DROP TABLE foods;*` | 400 ou résultat vide — pas d'exécution |
| JWT falsifié | JWT avec signature invalide | 401 |
| JWT expiré | JWT avec exp dans le passé | 401 |
| Accès planning sans abonnement | POST /generate-meal-plan après expiration essai | 403 |
| Clé API externe côté client | Inspection du bundle JS | Aucune clé visible (stockées Supabase Secrets) |
| Webhook Stripe sans signature | POST /stripe-webhook sans header Stripe-Signature | 401 |
| Upload photo malveillante | Photo avec métadonnées EXIF contenant scripts | Métadonnées strippées, photo acceptée |

---

## 5. Tests de Performance

| Scénario | Cible | Outil |
|---|---|---|
| Génération planning (1 utilisateur) | < 10 secondes | Jest + timer |
| Génération planning (10 en parallèle) | < 15 secondes | k6 |
| Chargement planning semaine | < 1 seconde | k6 |
| Validation repas 1 clic | < 500 ms | k6 |
| Reconnaissance photo | < 5 secondes | Jest + mock Vision |
| Génération rapport hebdomadaire (100 utilisateurs simultanés) | < 60 secondes (batch) | pg_cron + monitoring |

---

## 6. Tests de Régression (UAT — Manuel)

> Checklist exécutée avant chaque release par le QA ou le product owner.

### Checklist pre-release

**Onboarding**
- [ ] Inscription email → confirmation email reçu
- [ ] Inscription Apple Login
- [ ] Inscription Google Login
- [ ] Onboarding 7 étapes sans blocage
- [ ] Profil enregistré correctement en BDD

**Planning & Menus**
- [ ] Génération planning semaine sans restrictions
- [ ] Génération avec allergies multiples (gluten + lactose)
- [ ] Génération régime vegan
- [ ] Génération avec pathologie diabète T2
- [ ] Aucun aliment hors saison dans le planning généré
- [ ] Swap fonctionne (3 tentatives max)
- [ ] Détail repas affiche quantités concrètes

**Liste de courses**
- [ ] Liste générée après planning
- [ ] Cochage / décochage fonctionnel
- [ ] Ajout manuel d'un article
- [ ] Suppression d'un article
- [ ] Export texte correct

**Batch Cooking**
- [ ] Guide week-end affiché correctement
- [ ] Guide quotidien mis à jour chaque jour
- [ ] Tâches cochables

**Validation**
- [ ] Validation 1 clic → points + modale Basile
- [ ] Validation photo → reconnaissance IA
- [ ] Validation texte → recherche fonctionnelle
- [ ] Double validation bloquée

**Gamification**
- [ ] Badge "Premier Repas" débloqué
- [ ] Streak incrémenté au 2ème repas du jour
- [ ] Rapport hebdomadaire visible

**Abonnement**
- [ ] Essai 30 jours actif pour nouveau compte
- [ ] Paywall à expiration essai
- [ ] Paiement mensuel Stripe (mode test)
- [ ] Accès rétabli immédiatement après paiement
- [ ] Résiliation accessible

**RGPD**
- [ ] Suppression compte → confirmation email
- [ ] CGU et politique de confidentialité accessibles
- [ ] Consentement requis avant collecte données santé

---

## 7. Environnements de test

| Environnement | Usage | Données |
|---|---|---|
| **Local** (Supabase CLI) | Tests unitaires + intégration dev | Seed de test, données fictives |
| **Staging** | Tests E2E + UAT | Données de test réalistes, Stripe mode test |
| **Production** | Smoke tests post-déploiement uniquement | Données réelles — tests minimalistes |

### Données de test (seed)

```
5 utilisateurs tests avec profils variés :
  - user_standard@test.com : profil standard, pas de restriction
  - user_vegan@test.com : vegan + allergie fruits à coque
  - user_diabete@test.com : diabète T2 + prédiabète
  - user_trial_expired@test.com : essai expiré
  - user_subscriber@test.com : abonné annuel actif

Planning semaine pré-généré pour chaque utilisateur
Liste de courses pré-générée
Historique de 4 semaines de validations
```

---

*Livrable 6 / 7 — Heal — Mai 2026*
