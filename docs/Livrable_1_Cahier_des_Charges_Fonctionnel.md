# Heal — Cahier des Charges Fonctionnel (CdCF)

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)  
**Statut :** En attente de validation sur les hypothèses signalées ⚠️

> **v1.1 — Changelog :** renommage Harméal → Heal ; US-023 enrichie (nature MTC + saveur d'un repas) ; nouvelle US-034 (lien vers producteurs locaux).

---

## Conventions

### Format des user stories
> *"En tant que [profil], je veux [action] afin de [bénéfice]"*

### Priorités
| Code | Signification |
|---|---|
| P0 | Bloquant — l'app ne peut pas fonctionner sans |
| P1 | Essentiel — fait partie du MVP complet |
| P2 | Utile — enrichit l'expérience mais non bloquant |

### Profils utilisateurs
- **Utilisateur** : toute personne avec un compte Heal
- **Abonné** : utilisateur avec abonnement actif ou en période d'essai
- **Nouveau** : utilisateur n'ayant pas encore complété l'onboarding

---

## Hypothèses validées ✅ — toutes confirmées

| # | Décision validée |
|---|---|
| H1 | **Français uniquement en v1** — multilingue (EN, NL, ES…) en phase 2 |
| H2 | Login social v1 : **Apple Login + Google Login + Microsoft Login + Facebook Login** |
| H3 | Notifications confirmées : 19h00 (dîner), vendredi 18h00 (courses), dimanche 10h00 (batch cooking), dimanche 20h00 (rapport) |
| H4 | Pas de doublon dans la semaine **sauf petits-déjeuners et collations** (peuvent se répéter) |
| H5 | **1 collation par jour activée par défaut**, désactivable par l'utilisateur |
| H6 | Jeûne intermittent : **16:8 ET 5:2** tous deux supportés en v1 |

---

## Épique 1 — Authentification & Compte

### US-001 — Inscription par email
**Priorité :** P0

> En tant que visiteur, je veux créer un compte avec mon email et un mot de passe afin d'accéder à Heal.

**Critères d'acceptation :**
- [ ] L'email doit être valide (format RFC 5322)
- [ ] Le mot de passe doit contenir au minimum 8 caractères, 1 majuscule, 1 chiffre
- [ ] Un email de confirmation est envoyé après inscription
- [ ] Le compte n'est pas actif avant confirmation de l'email
- [ ] Si l'email est déjà utilisé, un message clair est affiché (sans révéler si le compte existe — sécurité)

**Règles métier :**
- La période d'essai de 30 jours démarre à la date de confirmation de l'email, pas de l'inscription
- Un seul compte par adresse email

---

### US-002 — Connexion Apple / Google ⚠️ H2
**Priorité :** P1

> En tant que visiteur, je veux me connecter avec mon compte Apple ou Google afin de ne pas avoir à gérer un mot de passe supplémentaire.

**Critères d'acceptation :**
- [ ] Connexion Apple Sign In fonctionnelle (obligatoire pour App Store si login social présent)
- [ ] Connexion Google OAuth fonctionnelle
- [ ] Si l'email du compte social est déjà utilisé en inscription classique, les deux comptes sont fusionnés
- [ ] La période d'essai démarre à la première connexion sociale

---

### US-003 — Connexion
**Priorité :** P0

> En tant qu'utilisateur inscrit, je veux me connecter à mon compte afin d'accéder à mes données et menus personnalisés.

**Critères d'acceptation :**
- [ ] Connexion email + mot de passe fonctionnelle
- [ ] Après 5 tentatives échouées, le compte est temporairement verrouillé 15 minutes
- [ ] Option "Rester connecté" (token persistant 30 jours)
- [ ] Redirection vers l'onboarding si le profil n'est pas complété

---

### US-004 — Mot de passe oublié
**Priorité :** P0

> En tant qu'utilisateur, je veux réinitialiser mon mot de passe par email afin de récupérer l'accès à mon compte.

**Critères d'acceptation :**
- [ ] Un lien de réinitialisation est envoyé si l'email existe (même message si l'email n'existe pas — sécurité)
- [ ] Le lien expire après 1 heure
- [ ] Le lien ne peut être utilisé qu'une seule fois
- [ ] Après réinitialisation, toutes les sessions actives sont invalidées

---

### US-005 — Suppression de compte (RGPD)
**Priorité :** P0

> En tant qu'utilisateur, je veux supprimer mon compte et toutes mes données afin d'exercer mon droit à l'oubli.

**Critères d'acceptation :**
- [ ] La suppression est accessible depuis les paramètres
- [ ] Une confirmation en deux étapes est demandée (saisie du mot de passe + confirmation)
- [ ] Toutes les données personnelles sont supprimées sous 30 jours (délai RGPD)
- [ ] Un email de confirmation de suppression est envoyé
- [ ] L'abonnement actif est résilié automatiquement chez Stripe
- [ ] Les données anonymisées agrégées (statistiques) sont conservées

---

### US-006 — Déconnexion
**Priorité :** P1

> En tant qu'utilisateur, je veux me déconnecter de l'application afin de sécuriser mon compte.

**Critères d'acceptation :**
- [ ] La déconnexion invalide le token de session côté serveur
- [ ] L'utilisateur est redirigé vers l'écran de connexion
- [ ] Les données en cache local sont effacées

---

## Épique 2 — Onboarding & Profil

### US-010 — Onboarding guidé par Basile
**Priorité :** P0

> En tant que nouvel utilisateur, je veux être guidé par Basile pour configurer mon profil afin que l'app génère des menus adaptés à ma situation.

**Critères d'acceptation :**
- [ ] L'onboarding se déroule en 7 étapes maximum (barre de progression visible)
- [ ] Chaque étape peut être précédée (retour arrière possible)
- [ ] Basile accompagne chaque étape avec un message contextuel
- [ ] Le message RGPD et de non-responsabilité médicale est affiché avant la collecte de données de santé
- [ ] L'onboarding peut être interrompu et repris (sauvegarde de la progression)
- [ ] À la fin de l'onboarding, Basile affiche un message de bienvenue personnalisé

---

### US-011 — Saisie des données physiologiques
**Priorité :** P0

> En tant que nouvel utilisateur, je veux renseigner mon âge, sexe, taille et poids afin que l'app calcule mes besoins nutritionnels de base.

**Critères d'acceptation :**
- [ ] Champs : date de naissance (→ calcul âge automatique), sexe (homme / femme / non-binaire / préfère ne pas dire), taille (cm), poids (kg)
- [ ] L'IMC est calculé automatiquement et stocké (non affiché à l'utilisateur sauf dans les paramètres)
- [ ] Validations : taille entre 100 et 250 cm, poids entre 30 et 300 kg, âge entre 16 et 100 ans
- [ ] Un consentement explicite à la collecte de données de santé est requis (checkbox obligatoire)

**Règles métier :**
- IMC = poids (kg) / taille² (m)
- IMC < 18.5 → profil "poids insuffisant" (ajustement calorique à la hausse)
- IMC 18.5–24.9 → profil "poids normal"
- IMC 25–29.9 → profil "surpoids" (légère réduction calorique, satiété priorisée)
- IMC ≥ 30 → profil "obésité" (réduction calorique modérée, satiété forte)

---

### US-012 — Niveau d'activité physique
**Priorité :** P0

> En tant que nouvel utilisateur, je veux indiquer mon niveau d'activité physique afin que l'app ajuste les quantités alimentaires à mon dépense énergétique réelle.

**Critères d'acceptation :**
- [ ] 4 niveaux proposés avec description concrète (pas de jargon) :
  - Sédentaire : "Je travaille assis, peu de marche"
  - Légèrement actif : "Je marche 30 min/jour ou sport léger 1-2x/semaine"
  - Modérément actif : "Sport 3-4x/semaine ou travail physique modéré"
  - Très actif : "Sport intense quotidien ou travail physique intensif"
- [ ] Le niveau peut être modifié à tout moment depuis le profil

**Règles métier — Multiplicateurs métaboliques (Harris-Benedict révisé) :**
- Sédentaire : BMR × 1.2
- Légèrement actif : BMR × 1.375
- Modérément actif : BMR × 1.55
- Très actif : BMR × 1.725

---

### US-013 — Pathologies déclarées
**Priorité :** P0

> En tant que nouvel utilisateur, je veux déclarer mes pathologies afin que l'app adapte les menus à mes contraintes de santé spécifiques.

**Critères d'acceptation :**
- [ ] Liste de pathologies avec sélection multiple :
  - Diabète de type 1
  - Diabète de type 2
  - Prédiabète
  - SOPK (syndrome des ovaires polykystiques)
  - Hypothyroïdie
  - Hypercholestérolémie
  - Hypertriglycéridémie
  - Maladie cœliaque
  - Maladie de Crohn / MICI
  - Aucune
- [ ] Un avertissement médical s'affiche dès qu'une pathologie est sélectionnée
- [ ] "Aucune" décoche toutes les autres options

**Règles métier par pathologie :**

| Pathologie | Règle appliquée aux menus |
|---|---|
| Diabète T1 / T2 / Prédiabète | IG max par repas = 40, charge glycémique journalière ≤ 80g |
| SOPK | Favoriser aliments anti-inflammatoires, limiter sucres raffinés |
| Hypothyroïdie | Limiter choux crus, soja (inhibiteurs thyroïdiens) |
| Hypercholestérolémie | Limiter graisses saturées < 7% des calories totales |
| Hypertriglycéridémie | Limiter alcool (signalement uniquement), sucres simples |
| Maladie cœliaque | Exclusion stricte gluten (même traces) |
| Crohn / MICI | Éviter fibres insolubles en crise, aliments irritants |

---

### US-014 — Allergies & restrictions alimentaires
**Priorité :** P0

> En tant que nouvel utilisateur, je veux déclarer mes allergies et préférences alimentaires afin qu'aucun aliment incompatible n'apparaisse dans mes menus.

**Critères d'acceptation :**
- [ ] Allergies (exclusion stricte) : gluten, lactose, œufs, fruits à coque, arachides, poisson, crustacés, soja, sésame, céleri, moutarde, sulfites
- [ ] Préférences (exclusion souple) : végétarien, vegan, halal, casher, sans porc, sans alcool en cuisine
- [ ] Dégoûts personnels : champ libre pour ajouter des aliments spécifiques à exclure (ex : "coriandre", "betterave")
- [ ] Un aliment dans les dégoûts peut être réactivé depuis le profil
- [ ] Les allergies sont toujours respectées, sans exception possible dans la génération

**Règles métier :**
- Vegan ⊃ Végétarien (sélectionner vegan décoche végétarien)
- Halal et casher peuvent coexister
- Si "sans gluten" ET "maladie cœliaque" : règle cœliaque (plus stricte) prime

---

### US-015 — Sélection de la région
**Priorité :** P0

> En tant que nouvel utilisateur, je veux choisir ma région afin que l'app ne propose que des aliments disponibles localement et de saison.

**Critères d'acceptation :**
- [ ] Liste déroulante des régions françaises (13 régions métropolitaines) + pays limitrophes (Belgique, Suisse, Luxembourg, Espagne, Italie, Allemagne)
- [ ] La région peut être modifiée depuis le profil
- [ ] La région influe sur le calendrier de saisonnalité actif

---

### US-016 — Données biologiques (optionnel)
**Priorité :** P1

> En tant qu'utilisateur, je veux renseigner mes résultats d'analyses médicales afin que l'app affine les menus selon mes paramètres biologiques réels.

**Critères d'acceptation :**
- [ ] Champs optionnels : glycémie à jeun (g/L), HbA1c (%), cholestérol total (g/L), triglycérides (g/L)
- [ ] Un avertissement rappelle que ces données ne constituent pas un diagnostic
- [ ] Chaque champ affiche les plages de référence (ex : glycémie à jeun normale : 0.70–1.10 g/L)
- [ ] Ces données sont modifiables à tout moment depuis le profil

**Règles métier :**

| Donnée | Seuil | Action |
|---|---|---|
| Glycémie à jeun > 1.26 g/L | Diabète probable | IG max repas réduit à 35, message de consultation médicale |
| HbA1c > 6.5% | Diabète probable | Idem |
| Cholestérol total > 2.0 g/L | Hypercholestérolémie | Réduction graisses saturées |
| Triglycérides > 1.5 g/L | Hypertriglycéridémie | Réduction sucres simples |

---

### US-017 — Consultation et modification du profil
**Priorité :** P1

> En tant qu'utilisateur, je veux consulter et modifier mon profil à tout moment afin de maintenir mes données à jour.

**Critères d'acceptation :**
- [ ] Toutes les données de l'onboarding sont modifiables
- [ ] La modification du poids, niveau d'activité ou pathologies déclenche une régénération du planning semaine en cours (avec confirmation utilisateur)
- [ ] L'historique des poids n'est pas conservé (pas de courbe de poids)
- [ ] La modification de la région prend effet à partir du prochain planning généré

---

## Épique 3 — Génération de menus

### US-020 — Génération du planning semaine
**Priorité :** P0

> En tant qu'abonné, je veux que l'app génère automatiquement un planning de repas pour la semaine afin de ne pas avoir à réfléchir à ce que je vais manger.

**Critères d'acceptation :**
- [ ] Le planning couvre 7 jours (lundi → dimanche)
- [ ] Chaque jour comporte : petit-déjeuner, déjeuner, dîner, 1 collation (sauf si jeûne activé)
- [ ] Aucun repas identique n'apparaît deux fois dans la même semaine
- [ ] Tous les aliments proposés sont de saison dans la région de l'utilisateur
- [ ] Toutes les allergies et restrictions sont strictement respectées
- [ ] Le planning respecte les règles glycémiques selon le profil
- [ ] La génération prend moins de 10 secondes
- [ ] Un message de chargement avec animation de Basile s'affiche pendant la génération
- [ ] Le planning peut être régénéré entièrement (confirmation requise si déjà validé des repas)

**Règles métier — Équilibre nutritionnel hebdomadaire :**
- Protéines : présentes à chaque déjeuner et dîner
- Légumes : minimum 2 portions par jour
- Légumineuses : minimum 2 fois par semaine
- Poisson gras (sardine, maquereau, hareng, saumon) : 1–2 fois par semaine
- Viande rouge : maximum 2 fois par semaine
- Fruits : 1–2 portions par jour (de préférence hors repas principal)
- Céréales complètes privilégiées sur céréales raffinées

**Règles métier — Contrôle glycémique :**
- Ordre de consommation suggéré dans chaque repas : légumes → protéines → féculents
- Combinaison systématique : si glucides → toujours accompagnés de fibres ET protéines
- Charge glycémique totale journalière adaptée selon le profil (normal : ≤ 120g / diabète : ≤ 80g)

---

### US-021 — Génération avec ingrédients disponibles
**Priorité :** P1

> En tant qu'abonné, je veux indiquer les ingrédients que j'ai déjà à la maison afin que l'app les intègre dans le planning et réduise ma liste de courses.

**Critères d'acceptation :**
- [ ] Avant la génération, l'utilisateur peut saisir une liste d'ingrédients disponibles (recherche textuelle)
- [ ] L'app tente de les intégrer dans le planning si compatibles (saison, restrictions, règles glycémiques)
- [ ] Un ingrédient disponible mais hors saison est signalé par un badge "hors saison 🌍" et utilisé quand même si l'utilisateur l'a validé
- [ ] Si un ingrédient disponible est incompatible (allergie), il est ignoré avec une explication

---

### US-022 — Swap d'un repas
**Priorité :** P1

> En tant qu'abonné, je veux remplacer un repas spécifique du planning afin de varier ou d'adapter un repas qui ne me convient pas.

**Critères d'acceptation :**
- [ ] Chaque repas dispose d'un bouton "Remplacer ce repas"
- [ ] Le nouveau repas respecte toutes les règles (saison, restrictions, glycémie, pas de doublon sur la semaine)
- [ ] Le remplacement n'affecte pas les autres repas de la semaine
- [ ] Maximum 3 swaps par repas (pour éviter les boucles infinies)
- [ ] Si le repas a déjà été validé comme mangé, le swap est désactivé

---

### US-023 — Affichage du détail d'un repas
**Priorité :** P0

> En tant qu'abonné, je veux voir le détail d'un repas afin de savoir exactement quels ingrédients utiliser et en quelle quantité.

**Critères d'acceptation :**
- [ ] Affichage : liste des ingrédients avec quantités en grammes ET en mesures concrètes (ex : "150g de carottes — environ 2 carottes moyennes")
- [ ] Affichage de l'ordre de consommation conseillé (légumes → protéines → féculents)
- [ ] Score glycémique estimé du repas (visuel simple : faible / modéré / élevé)
- [ ] Valeurs nutritionnelles simplifiées : protéines, glucides, lipides, fibres
- [ ] Nature énergétique dominante du repas en diététique chinoise (froid/frais/neutre/tiède/chaud), affichage discret (non un score, un simple tag informatif)
- [ ] Message éducatif de Basile expliquant pourquoi ce repas est bon, avec occasionnellement un éclairage MTC en complément de l'explication nutritionnelle (cf. US-053)

---

### US-024 — Jeûne intermittent ⚠️ H6
**Priorité :** P1

> En tant qu'abonné, je veux activer le jeûne intermittent 16:8 afin d'adapter mon planning à cette pratique.

**Critères d'acceptation :**
- [ ] Activation depuis le profil ou le planning
- [ ] En mode 16:8 : suppression du petit-déjeuner et de la collation matinale
- [ ] La fenêtre alimentaire est configurable (ex : 12h–20h)
- [ ] Le déjeuner devient le premier repas et est enrichi (apports du petit-déjeuner répartis)
- [ ] Un message d'information de Basile explique le jeûne intermittent à l'activation

---

## Épique 4 — Liste de courses

### US-030 — Génération de la liste de courses
**Priorité :** P0

> En tant qu'abonné, je veux que l'app génère automatiquement la liste de courses de la semaine afin de gagner du temps au marché ou en supermarché.

**Critères d'acceptation :**
- [ ] La liste est générée automatiquement à partir du planning semaine
- [ ] Si des ingrédients disponibles ont été déclarés (US-021), ils sont déduits de la liste
- [ ] Les quantités sont consolidées (ex : si carottes dans 3 recettes → "450g de carottes — environ 6 carottes")
- [ ] La liste est organisée par catégorie : Légumes & fruits, Protéines (viandes/poissons), Produits laitiers, Épicerie sèche, Herbes & épices
- [ ] Les aliments de saison sont signalés par une icône 🌱

---

### US-031 — Gestion de la liste de courses
**Priorité :** P0

> En tant qu'abonné, je veux cocher les articles achetés afin de suivre ma progression au marché.

**Critères d'acceptation :**
- [ ] Chaque article est cochable (grisé une fois coché)
- [ ] Les articles cochés descendent en bas de liste automatiquement
- [ ] Un bouton "Tout décocher" permet de recommencer
- [ ] La liste est persistante (sauvegardée même si on quitte l'app)

---

### US-032 — Modification manuelle de la liste
**Priorité :** P1

> En tant qu'abonné, je veux ajouter ou supprimer des articles de la liste afin de la personnaliser selon mes besoins.

**Critères d'acceptation :**
- [ ] Ajout d'un article libre (texte + quantité optionnelle)
- [ ] Suppression d'un article par swipe ou bouton
- [ ] Les articles ajoutés manuellement sont distingués visuellement
- [ ] Les modifications manuelles ne sont pas écrasées si le planning est régénéré (confirmation demandée)

---

### US-033 — Export / partage de la liste
**Priorité :** P2

> En tant qu'abonné, je veux partager ma liste de courses afin de la consulter hors connexion ou de la partager avec quelqu'un.

**Critères d'acceptation :**
- [ ] Export par partage natif (iOS Share Sheet / Android Share Intent) au format texte brut
- [ ] Les articles cochés sont exclus de l'export par défaut (option de les inclure)

---

### US-034 — Trouver un producteur local
**Priorité :** P2

> En tant qu'abonné, je veux être orienté vers des producteurs locaux près de chez moi afin d'acheter mes ingrédients en circuit court quand c'est possible.

**Critères d'acceptation :**
- [ ] Un lien "Trouver un producteur près de chez vous" est affiché en en-tête de la liste de courses
- [ ] Le lien pointe vers une ressource externe pertinente selon la région de l'utilisateur (Agrilocal, Bienvenue à la ferme, marché de producteurs local — cf. Product Brief §10)
- [ ] Aucune promesse d'inventaire producteur en temps réel dans l'app — c'est une redirection, pas un annuaire intégré
- [ ] Le libellé précise qu'il s'agit d'un lien externe (ouverture navigateur)

**Règle métier :**
- Il n'existe pas de base de données nationale unifiée producteurs × produits en accès libre (voir recherche Product Brief §10) — cette story ne doit pas être interprétée comme nécessitant la construction d'un tel annuaire en v1

---

## Épique 5 — Guide Batch Cooking

### US-040 — Guide de préparation du week-end
**Priorité :** P0

> En tant qu'abonné, je veux un guide de préparation pour le week-end afin d'organiser efficacement mes 2h de cuisine en amont.

**Critères d'acceptation :**
- [ ] La liste des tâches du week-end est générée automatiquement depuis le planning
- [ ] Chaque tâche est catégorisée : Découpe / Marinade / Cuisson longue (passive) / Base de sauce / Cuisson active
- [ ] Les cuissons longues (four, mijoteuse) sont marquées "passives" et n'entrent pas dans le compteur de 2h
- [ ] Les tâches sont ordonnées de façon logique (cuissons longues lancées en premier)
- [ ] Chaque tâche est cochable
- [ ] Durée estimée totale affichée (hors cuissons passives)
- [ ] Basile donne un conseil d'organisation en tête du guide

**Règles métier — Tâches batch cooking types :**
- Éplucher et couper les légumes racines → conserve 5 jours au frigo
- Cuire les légumineuses en grande quantité → conserve 4 jours au frigo
- Préparer les marinades → conserve 3 jours au frigo
- Lancer les bouillons / mijotés → cuisson passive 3–6h
- Cuire les céréales en grande quantité → conserve 5 jours au frigo

---

### US-041 — Guide quotidien (30 min / soir)
**Priorité :** P0

> En tant qu'abonné, je veux un guide de préparation quotidien afin de savoir exactement quoi faire le soir pour finaliser mon repas.

**Critères d'acceptation :**
- [ ] Le guide du soir est spécifique à chaque repas de la journée
- [ ] Il liste uniquement les tâches restantes (assemblage, cuisson courte, finition)
- [ ] Chaque tâche indique quoi sortir du frigo / congélateur préparé le week-end
- [ ] Durée estimée affichée (objectif : ≤ 30 min)
- [ ] Tâches cochables une par une

---

## Épique 6 — Validation des repas

### US-050 — Validation en 1 clic
**Priorité :** P0

> En tant qu'abonné, je veux valider un repas en un seul clic afin de confirmer que j'ai bien mangé ce qui était prévu sans effort.

**Critères d'acceptation :**
- [ ] Bouton "J'ai mangé ça ✓" visible directement sur le planning et le détail du repas
- [ ] La validation déclenche immédiatement le message d'encouragement de Basile
- [ ] Les points de gamification sont crédités instantanément
- [ ] Un repas validé ne peut plus être swappé
- [ ] La validation d'un repas passé est possible jusqu'à 24h après l'horaire prévu

---

### US-051 — Validation par photo
**Priorité :** P1

> En tant qu'abonné, je veux prendre une photo de mon repas pour le valider afin de pouvoir déclarer un repas différent du menu prévu.

**Critères d'acceptation :**
- [ ] L'utilisateur peut prendre une photo ou en sélectionner une depuis la galerie
- [ ] L'IA identifie les aliments présents dans la photo
- [ ] Une liste d'aliments détectés est affichée pour confirmation / correction manuelle
- [ ] Si les aliments sont compatibles avec le profil (pas d'allergènes détectés), la validation est confirmée
- [ ] Si des aliments non compatibles sont détectés, un avertissement s'affiche (pas un blocage)
- [ ] Les points attribués sont calculés selon la qualité nutritionnelle estimée du repas photographié
- [ ] En cas d'échec de la reconnaissance (plat trop complexe), l'utilisateur est invité à valider manuellement

---

### US-052 — Validation par recherche textuelle
**Priorité :** P1

> En tant qu'abonné, je veux rechercher et sélectionner les aliments que j'ai mangés afin de valider un repas libre.

**Critères d'acceptation :**
- [ ] Barre de recherche avec auto-complétion dans la base d'aliments
- [ ] Sélection multiple d'aliments possible
- [ ] Saisie des quantités pour chaque aliment sélectionné (en grammes ou en mesures concrètes)
- [ ] Calcul du score nutritionnel et glycémique du repas saisi
- [ ] Confirmation et message de Basile après validation

---

### US-053 — Message d'encouragement Basile post-repas
**Priorité :** P0

> En tant qu'abonné, je veux recevoir un message personnalisé de Basile après chaque repas validé afin de comprendre les bénéfices de ce que j'ai mangé.

**Critères d'acceptation :**
- [ ] Le message s'affiche dans une modale avec l'animation de Basile
- [ ] Le message mentionne spécifiquement un aliment du repas et son bénéfice nutritionnel
- [ ] Le message indique les points gagnés
- [ ] Le message change à chaque repas (pas de répétition dans la même semaine)
- [ ] Le message est positif même si le repas était moins bon qu'attendu (pas de jugement)
- [ ] Environ 1 message sur 4 inclut, en complément de l'explication nutritionnelle occidentale, un éclairage de diététique chinoise sur un aliment du repas (nature énergétique, saveur) — jamais en remplacement du message nutritionnel, toujours en plus

**Exemples de messages :**
> *"Tes haricots verts t'ont apporté des fibres solubles qui ont ralenti l'absorption du riz. Ton pancréas a eu une soirée tranquille. +12 points !"*
> *"Le maquereau de ce midi est riche en oméga-3. Ton cœur et ton cerveau te disent merci. +15 points !"*
> *"Les lentilles contiennent du fer végétal et des protéines complètes. Un duo gagnant pour ton énergie de l'après-midi. +10 points !"*
> *"Le gingembre de ta soupe est un aliment 'chaud' en diététique chinoise — parfait pour réchauffer l'organisme en hiver, en plus de ses propriétés anti-inflammatoires reconnues en nutrition moderne. +10 points !"*

---

## Épique 7 — Gamification

### US-060 — Système de points
**Priorité :** P1

> En tant qu'abonné, je veux gagner des points à chaque repas validé afin de suivre mes progrès de manière ludique.

**Critères d'acceptation :**
- [ ] Points attribués selon la qualité nutritionnelle du repas :
  - Repas conforme au menu Heal : 15 points
  - Repas validé par photo (bon score) : 10–15 points
  - Repas validé par photo (score moyen) : 5–10 points
  - Repas saisi manuellement : 5–12 points selon score
- [ ] Bonus streak : +5 points si 3 jours consécutifs, +10 points si 7 jours
- [ ] Total de points visible sur la home et le profil
- [ ] Historique des points consultable (par semaine)

---

### US-061 — Badges
**Priorité :** P1

> En tant qu'abonné, je veux débloquer des badges afin de célébrer mes accomplissements alimentaires.

**Critères d'acceptation :**
- [ ] Notification in-app à chaque nouveau badge débloqué
- [ ] Les badges sont consultables dans une galerie (avec ceux non débloqués en grisé)
- [ ] Chaque badge non débloqué affiche sa condition d'obtention

**Liste des badges v1 :**

| Badge | Nom | Condition |
|---|---|---|
| 🌱 | Premier Repas | Valider son premier repas |
| 🔥 | 3 jours d'affilée | 3 jours consécutifs respectés |
| ⭐ | Semaine parfaite | 7 jours × 3 repas validés |
| 🥦 | Amateur de légumes | 5 repas avec 2+ portions de légumes |
| 🐟 | Ami des oméga-3 | 3 repas avec poisson gras dans la semaine |
| 🫘 | Fan de légumineuses | Manger des légumineuses 4 semaines de suite |
| 🌿 | Saisonnier confirmé | 30 jours sans aliment hors saison |
| 🦡 | Ami de Basile | Compléter l'onboarding + premier planning généré |
| 🍂 | Toutes saisons | Utiliser l'app pendant les 4 saisons |
| 💪 | Un mois Heal | 30 jours d'utilisation active |

---

### US-062 — Streaks
**Priorité :** P1

> En tant qu'abonné, je veux voir mon streak de jours consécutifs afin d'être motivé à maintenir mes bonnes habitudes.

**Critères d'acceptation :**
- [ ] Un jour compte si au moins 2 repas principaux sont validés (déjeuner OU dîner + 1 autre)
- [ ] Le streak s'affiche sur la home avec une flamme animée
- [ ] Si un jour est manqué, le streak repart à 0 avec un message bienveillant de Basile
- [ ] Le streak maximum historique est conservé et affiché

---

## Épique 8 — Rapport hebdomadaire

### US-070 — Rapport de la semaine ⚠️ H3
**Priorité :** P1

> En tant qu'abonné, je veux recevoir un rapport hebdomadaire automatique afin de comprendre comment j'ai mangé cette semaine et ce que ça a apporté à mon corps.

**Critères d'acceptation :**
- [ ] Le rapport est généré chaque dimanche soir à 20h
- [ ] Une notification push est envoyée à l'utilisateur
- [ ] Le rapport contient :
  - Score glycémique estimé de la semaine (visuel couleur vert/orange/rouge)
  - Score de diversité alimentaire (nombre de familles d'aliments différents)
  - Nombre de repas validés / total possible
  - Top 3 des meilleurs repas de la semaine
  - Conseil personnalisé de Basile pour la semaine suivante
- [ ] Le rapport est consultable depuis l'historique (12 semaines conservées)

---

## Épique 9 — Saisonnalité

### US-080 — Calendrier de saison
**Priorité :** P1

> En tant qu'abonné, je veux consulter le calendrier des fruits et légumes de saison afin de savoir ce qui est disponible localement ce mois-ci.

**Critères d'acceptation :**
- [ ] Vue mensuelle des fruits et légumes disponibles dans la région de l'utilisateur
- [ ] Navigation entre les mois possible
- [ ] Chaque aliment affiche : nom, icône, conseil de conservation, bénéfice nutritionnel principal
- [ ] Les aliments actuellement utilisés dans le planning de l'utilisateur sont mis en valeur

---

### US-081 — Gestion des aliments hors saison
**Priorité :** P0

> En tant qu'abonné, je veux être informé si un aliment que je possède est hors saison afin de comprendre son impact environnemental.

**Critères d'acceptation :**
- [ ] Un aliment hors saison saisi dans les disponibilités est accepté avec un badge "hors saison 🌍"
- [ ] Un message court de Basile explique l'alternative de saison disponible
- [ ] L'app ne génère jamais de menu avec des aliments hors saison de sa propre initiative
- [ ] Aucun blocage : l'utilisateur garde le choix final

---

## Épique 10 — Abonnement & Paiement

### US-090 — Période d'essai gratuite
**Priorité :** P0

> En tant que nouvel utilisateur, je veux bénéficier de 30 jours d'essai gratuit afin d'évaluer l'app avant de m'engager.

**Critères d'acceptation :**
- [ ] Toutes les fonctionnalités sont accessibles pendant 30 jours
- [ ] Un indicateur visible montre les jours restants d'essai (affiché à partir de J-7)
- [ ] À J-3, une notification de rappel est envoyée
- [ ] À J-1, un dernier rappel avec incitation à s'abonner
- [ ] À J+0 (expiration), un écran d'abonnement s'affiche avant d'accéder à l'app
- [ ] Aucune donnée n'est perdue après expiration (le profil et l'historique sont conservés)

---

### US-091 — Souscription à l'abonnement
**Priorité :** P0

> En tant qu'utilisateur en fin d'essai, je veux souscrire un abonnement afin de continuer à utiliser Heal.

**Critères d'acceptation :**
- [ ] Deux offres proposées : mensuelle (6,99 €/mois) et annuelle (49,99 €/an, mise en avant)
- [ ] Paiement via Stripe (web) et App Store / Google Play (mobile) — RevenueCat comme couche d'abstraction
- [ ] Confirmation par email après souscription
- [ ] L'accès est immédiatement rétabli après paiement
- [ ] Les CGV et mentions légales sont accessibles depuis l'écran d'abonnement

---

### US-092 — Gestion de l'abonnement
**Priorité :** P0

> En tant qu'abonné, je veux gérer mon abonnement afin de le modifier ou le résilier.

**Critères d'acceptation :**
- [ ] Affichage du statut : type d'abonnement, date de renouvellement, montant
- [ ] Résiliation possible depuis l'app (redirigée vers App Store / Google Play selon la plateforme)
- [ ] Après résiliation, l'accès reste actif jusqu'à la fin de la période payée
- [ ] Pas de remboursement au prorata (mention dans les CGV)

---

## Épique 11 — Notifications ⚠️ H3

### US-100 — Notifications push
**Priorité :** P1

> En tant qu'abonné, je veux recevoir des notifications utiles afin d'être rappelé aux moments clés de ma journée.

**Critères d'acceptation :**
- [ ] Toutes les notifications sont désactivables individuellement depuis les paramètres
- [ ] Les horaires par défaut sont configurables par l'utilisateur

**Notifications prévues :**

| Notification | Déclencheur | Horaire défaut | Désactivable |
|---|---|---|---|
| Rappel validation dîner | Chaque jour | 19h00 | Oui |
| Rappel liste de courses | Chaque vendredi | 18h00 | Oui |
| Rappel batch cooking | Chaque dimanche | 10h00 | Oui |
| Rapport hebdomadaire disponible | Chaque dimanche | 20h00 | Oui |
| Fin d'essai J-3 | J-3 avant expiration | Matin | Non |
| Fin d'essai J-1 | J-1 avant expiration | Matin | Non |
| Nouveau badge débloqué | À l'événement | Immédiat | Oui |

---

## Épique 12 — Légal & RGPD

### US-110 — Consentement RGPD
**Priorité :** P0

> En tant que visiteur, je veux donner mon consentement éclairé à la collecte de mes données afin de comprendre comment elles sont utilisées.

**Critères d'acceptation :**
- [ ] Consentement explicite requis avant collecte de toute donnée de santé (case à cocher, pas de pré-cochage)
- [ ] Lien vers la Politique de confidentialité accessible avant validation
- [ ] Le refus de consentement empêche la collecte des données de santé (seules les données de compte restent)
- [ ] Le consentement est horodaté et conservé

---

### US-111 — Accès aux documents légaux
**Priorité :** P0

> En tant qu'utilisateur, je veux accéder à tout moment aux CGU et à la politique de confidentialité afin de comprendre mes droits.

**Critères d'acceptation :**
- [ ] CGU accessibles depuis les paramètres et l'écran d'inscription
- [ ] Politique de confidentialité accessible depuis les paramètres et l'écran d'inscription
- [ ] Mention d'hébergement HDS et localisation des données (France / UE)
- [ ] Contact DPO (Délégué à la Protection des Données) mentionné

---

### US-112 — Avertissement médical permanent
**Priorité :** P0

> En tant qu'utilisateur avec une pathologie déclarée, je veux être rappelé régulièrement que l'app ne remplace pas un suivi médical afin d'être protégé.

**Critères d'acceptation :**
- [ ] L'avertissement médical s'affiche à chaque modification du profil santé
- [ ] Un rappel s'affiche dans le rapport hebdomadaire si une pathologie est déclarée
- [ ] L'avertissement est court, lisible, non anxiogène

---

## Récapitulatif des user stories

| Épique | Stories | P0 | P1 | P2 |
|---|---|---|---|---|
| 1 — Auth & Compte | 6 | 4 | 1 | 1 |
| 2 — Onboarding & Profil | 8 | 5 | 2 | 1 |
| 3 — Génération menus | 5 | 2 | 2 | 1 |
| 4 — Liste de courses | 5 | 2 | 1 | 2 |
| 5 — Batch cooking | 2 | 2 | 0 | 0 |
| 6 — Validation repas | 4 | 2 | 2 | 0 |
| 7 — Gamification | 3 | 0 | 3 | 0 |
| 8 — Rapport hebdo | 1 | 0 | 1 | 0 |
| 9 — Saisonnalité | 2 | 1 | 1 | 0 |
| 10 — Abonnement | 3 | 3 | 0 | 0 |
| 11 — Notifications | 1 | 0 | 1 | 0 |
| 12 — Légal & RGPD | 3 | 3 | 0 | 0 |
| **Total** | **43** | **24** | **14** | **5** |

---

## Toutes les décisions sont validées ✅

Aucune question ouverte — le cahier des charges est figé et prêt pour le développement.

---

*Livrable 1 / 7 — Heal — Mai 2026*
