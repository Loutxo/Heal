# Heal — Product Brief

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)  
**Statut :** Cadrage initial validé

> **v1.1 — Changelog :** renommage Harméal → Heal (§3) ; ajout de la lecture diététique traditionnelle chinoise (§1, §4, §8) ; ajout de la position produit sur les producteurs locaux (§10, §13).

---

## Table des matières

1. [Vision & Concept](#1-vision--concept)
2. [Benchmark concurrents](#2-benchmark-concurrents)
3. [Identité de marque](#3-identité-de-marque)
4. [Mascotte — Basile le blaireau](#4-mascotte--basile-le-blaireau)
5. [Palette, typographie & logo](#5-palette-typographie--logo)
6. [Utilisateurs cibles](#6-utilisateurs-cibles)
7. [Données collectées](#7-données-collectées)
8. [Fonctionnement cœur de l'app](#8-fonctionnement-cœur-de-lapp)
9. [Gestion des menus & repas](#9-gestion-des-menus--repas)
10. [Saisonnalité & Localité](#10-saisonnalité--localité)
11. [Expérience utilisateur & Gamification](#11-expérience-utilisateur--gamification)
12. [Architecture technique](#12-architecture-technique)
13. [Modèle économique](#13-modèle-économique)
14. [Aspects légaux & RGPD](#14-aspects-légaux--rgpd)
15. [Différenciateurs & positionnement](#15-différenciateurs--positionnement)

---

## 1. Vision & Concept

### Vision produit
> Heal est une application qui génère un **planning repas hebdomadaire personnalisé**, basé sur des aliments de saison et locaux, optimisé pour limiter les pics d'insuline — avec une liste de courses et un guide batch cooking. L'utilisateur n'a besoin d'aucune connaissance nutritionnelle préalable.

### Philosophie
- **Pas un régime.** Pas une contrainte. Une harmonie retrouvée entre le corps, l'assiette et les saisons.
- **Cuisiner, pas acheter tout fait.** L'app encourage la cuisine maison, simple et rapide — 2h de préparation le week-end, 30 min par soir pour assembler et terminer.
- **Éduquer sans imposer.** Les connaissances nutritionnelles sont délivrées via la gamification et les encouragements, jamais comme un cours magistral.

### Tagline
- **EN :** *Your plate, in harmony with the seasons and your body*
- **FR :** *L'harmonie dans votre assiette, et votre corps au fil des saisons*

### Deux traditions, une même boussole
Heal s'appuie sur deux corpus qui, dans les faits, disent souvent la même chose avec un vocabulaire différent :

| | Nutrition moderne | Diététique traditionnelle chinoise |
|---|---|---|
| Ce qu'elle mesure | Index/charge glycémique, macronutriments, fibres | Nature énergétique de l'aliment (froid → chaud), saveur, affinité d'organe |
| Ce qu'elle recommande | Manger de saison limite le stress oxydatif et maximise la densité nutritionnelle | Manger de saison maintient l'équilibre Yin-Yang du corps avec son environnement |
| Exemple concret | Concombre cru l'été : faible IG, hydratant | Concombre : nature "froide", rafraîchit le corps en été |

Heal ne demande pas de choisir entre les deux : la génération de menus s'appuie en priorité sur les règles nutritionnelles occidentales (IG, CG, pathologies — cf. §8), et la diététique chinoise vient **enrichir** le choix parmi les options déjà valides (nature de l'aliment, petit coup de pouce saisonnier) et **nourrir les messages éducatifs de Basile**. Aucune des deux traditions n'est présentée comme supérieure ou comme un substitut à un avis médical.

---

## 2. Benchmark concurrents

| Application | IG natif | Planning semaine | Saisonnier/Local | Cuisine maison | Facilité |
|---|---|---|---|---|---|
| **Yazio** | Oui (base) | Excellent | ❌ | Oui | Très bonne |
| **MyFitnessPal** | ❌ | Bon | ❌ | Non | Très bonne |
| **Cronometer** | ❌ (roadmap depuis 2017) | Limité | ❌ | Non | Complexe |
| **Lifesum** | Partiel | Excellent | ❌ | Oui | Très bonne |
| **Foodvisor** (FR) | ❌ | Bon | ❌ | Oui | Très bonne |
| **IG Indice** (FR) | Oui | Minimal | ❌ | ❌ | Basique |
| **Dieteclic** (FR) | Oui | Minimal | ❌ | ❌ | Basique |

### Conclusion
**Aucune application existante ne combine :**
- Index glycémique natif
- Planning semaine complet clé-en-main
- Saisonnalité et localité des aliments
- Guide batch cooking

C'est le vide stratégique qu'Heal occupe.

---

## 3. Identité de marque

### Nom
**Heal**
- Prononciation : *Hiil* (FR/EN) — se lit et s'entend comme le mot anglais *heal* ("soigner, apaiser")
- Double ancrage : 和 (*Hé*), le caractère chinois qui signifie littéralement "harmonie" — pierre angulaire de la diététique traditionnelle chinoise — **et** *heal* en anglais, l'apaisement du corps. Le "M" de repas (*meal*) est implicite dans l'expérience mais n'est plus dans le nom : plus court, plus universel
- Mémorable, court, se prononce sans effort en français comme en anglais
- ⚠️ À vérifier avant dépôt : disponibilité de la marque et des domaines `heal.app` / `heal.fr` (nom générique anglais, forte probabilité de conflits — prévoir un plan B : `heal-app.fr`, `getheal.app`, ou activer le nom de scène "Heal by Basile")

### Concept de marque
L'harmonie renvoie à la glycémie stable, aux combinaisons alimentaires intelligentes, au rythme du corps — un principe que l'on retrouve aussi bien dans la diététique occidentale moderne (index glycémique, micronutrition) que dans la diététique traditionnelle chinoise (équilibre Yin-Yang, nature des aliments, rythme des saisons). Manger ce que la terre donne au bon moment, dans les bonnes quantités, dans le bon ordre — et dans la bonne "nature" énergétique. Heal ne tranche pas entre ces deux traditions : il les fait dialoguer, sans jamais transformer l'une ou l'autre en dogme.

### Ton de voix

| Situation | Ton | Exemple |
|---|---|---|
| Onboarding | Chaleureux, bienveillant | *"Bonjour ! Basile va vous préparer une semaine sur mesure."* |
| Encouragement post-repas | Enthousiaste + éducatif | *"Excellent choix ! Les fibres des haricots verts ont ralenti l'absorption du riz — votre insuline est restée tranquille."* |
| Avertissement médical | Sérieux mais doux | *"Basile vous conseille de partager ces informations avec votre médecin."* |
| Liste de courses | Pratique, complice | *"Il vous manque 6 ingrédients. Basile a tout listé dans l'ordre du marché."* |
| Streak raté | Indulgent, motivant | *"Pas de souci — même Basile rate parfois son planning. On reprend ensemble ?"* |

### Slogans par écran

| Écran | Slogan |
|---|---|
| Accueil | *Your plate, in harmony with the seasons and your body* |
| Planning semaine | *Cette semaine, Basile a pensé à tout.* |
| Liste de courses | *Tout ce qu'il vous faut. Rien de superflu.* |
| Après un repas validé | *En harmonie. Continuez comme ça.* |
| Rapport hebdomadaire | *Une semaine bien vécue. Voici ce que votre corps en dit.* |

---

## 4. Mascotte — Basile le blaireau

### Caractère
- **Calme et rassurant** — il ne juge jamais, il guide
- **Légèrement malicieux** — il glisse une petite blague dans les encouragements
- **Passionné de marché** — il connaît les maraîchers par leur prénom
- **Méthodique** — il prépare sa semaine avec soin, sans stress
- Le batch cooker idéal : il fait tout le dimanche et se régale toute la semaine

### Apparence (brief designer)
- Corps rond et doux, rayures caractéristiques blaireau (blanc/gris/noir)
- **Toque de chef** blanche, bien ronde et bombée, légèrement penchée sur le côté (décontracté)
- Base de la toque avec un liseré terracotta `#C4694F`
- Petite feuille de saison glissée dans le liseré (change selon la saison dans l'app)
- Grands yeux noirs brillants en amande, légèrement tombants (bienveillant, pas naïf)
- Petit nez ovale noir, centré
- Bouche minuscule en arc — sourire discret, pas exagéré
- Deux petites joues rondes terracotta (blush kawaii)
- Rayures blaireau stylisées : bande blanche centrale du front au nez, bandes foncées sur les côtés
- Petites oreilles rondes, légèrement pointues, intérieur vert sauge `#8FAF8A`
- **Style : kawaii, flat design, propre et vectoriel**

### Prompt Midjourney / Firefly
```
Kawaii badger face, round head, big black shiny eyes, small black nose,
tiny smile, rosy terracotta cheeks, white stripe on forehead, dark side stripes,
white puffy chef hat slightly tilted, sage green ear interior,
flat design, clean vector style, warm cream background,
app icon format --ar 1:1 --style cute
```

### Basile à travers les saisons

| Saison | Élément / Organe (MTC) | Tenue | Ce qu'il porte | Ce qu'il dit |
|---|---|---|---|---|
| 🌱 Printemps | Bois — Foie | Tablier vert tendre, manches retroussées | Brin d'asperge dans la toque, panier de radis | *"Les premières pousses sont là — votre foie va adorer !"* |
| ☀️ Été | Feu — Cœur | Tablier crème, chapeau de paille | Petite tomate cerise dans la toque, courgettes | *"Légumes crus d'abord — votre glycémie vous remerciera."* |
| 🍂 Automne | Métal — Poumon | Tablier terracotta, petite écharpe | Feuille de chêne dans la toque, courge | *"C'est la saison du collagène — mijotez long, mangez bien."* |
| ❄️ Hiver | Eau — Reins | Pull en laine sous le tablier, nez rouge | Branche de houx dans la toque, agrumes | *"Les racines nourrissent en profondeur. Basile approuve."* |

> Note de cadrage : la Terre / Rate (5ᵉ élément du Wu Xing, associé aux intersaisons) n'a pas de couleur d'accent ni de tenue dédiée en v1 — on garde 4 saisons pour rester cohérent avec l'UI occidentale existante (§5, §10). Elle est mentionnée narrativement par Basile lors des transitions de saison plutôt que matérialisée comme 5ᵉ état visuel.

### Basile dans l'app
- Accueille l'utilisateur à l'onboarding
- Donne les encouragements post-repas avec explication nutritionnelle
- Célèbre les streaks (*"7 jours d'affilée — même moi je suis impressionné"*)
- Accompagne la liste de courses avec des conseils de marché
- Porte un badge de saison sur sa toque qui change automatiquement

---

## 5. Palette, typographie & logo

### Palette de couleurs

| Rôle | Couleur | Hex |
|---|---|---|
| Fond principal | Crème | `#F5EDD8` |
| Primaire / CTA | Terracotta | `#C4694F` |
| Secondaire / succès | Vert sauge | `#8FAF8A` |
| Textes | Brun chaud | `#5C3D2E` |
| Fonds secondaires | Blanc cassé | `#FAF7F2` |

**Accents saisonniers :**

| Saison | Couleur accent | Hex |
|---|---|---|
| 🌱 Printemps | Vert tendre | `#A8CC8C` |
| ☀️ Été | Jaune soleil | `#F0C040` |
| 🍂 Automne | Terracotta | `#C4694F` |
| ❄️ Hiver | Bleu nuit doux | `#4A6580` |

### Typographie

| Usage | Police | Style |
|---|---|---|
| Logo | Recoleta | Serif arrondi, chaleureux, artisanal |
| Titres in-app | Lora | Serif lisible, humain |
| Corps de texte | Inter | Sans-serif neutre, excellent sur mobile |
| Messages de Basile | Lora Italic | Voix distincte de la mascotte |

### Logo

**Icône app :**
Tête kawaii de Basile (blaireau avec toque de chef), fond carré aux coins très arrondis, couleur crème `#F5EDD8`, légère texture grain de papier.

**Logo complet :**
Tête de Basile à gauche + **Heal** en Recoleta à droite.
- "He" en Recoleta brun chaud `#5C3D2E` (clin d'œil à 和 *Hé*, "harmonie" en chinois)
- "al" en Recoleta terracotta `#C4694F`

**Versions :**

| Usage | Version |
|---|---|
| Icône app | Tête seule, fond crème arrondi |
| Logo complet | Tête + Heal en Recoleta |
| Splash screen | Tête + Heal + tagline FR |
| Favicon web | Tête ultra-simplifiée (yeux + toque) |

### Expérience saisonnière de l'interface

| Saison | Ambiance fond | Basile | Animation d'accueil |
|---|---|---|---|
| Printemps | Crème + vert tendre | Tablier vert, asperges | Petites pousses qui grandissent |
| Été | Crème + ocre chaud | Chapeau de paille, tomates | Soleil qui monte |
| Automne | Crème + brun doré | Écharpe, courge | Feuilles qui tombent doucement |
| Hiver | Crème + bleu nuit doux | Pull laine, agrumes | Buée sur une fenêtre |

---

## 6. Utilisateurs cibles

### 4 profils — mêmes règles diététiques, paramètres différents

| Profil | Ce qui varie |
|---|---|
| Grand public | Quantités standard, objectif bien-être général |
| Prédiabétique / diabétique | Seuils glycémiques stricts, avertissement médical renforcé |
| Surpoids / obèse | Satiété priorisée, déficit calorique modéré |
| Senior (60+) | Besoins protéiques plus élevés, collagène, antioxydants |

**Exclusion volontaire :** les familles avec enfants — profils trop hétérogènes au sein d'une même unité familiale.

### Niveau de motivation attendu
L'utilisateur souhaite cuisiner, pas acheter tout fait. Il cherche :
- Des menus hebdomadaires prêts à l'emploi
- Une liste de courses optimisée (avec prise en compte des ingrédients déjà disponibles)
- Un guide de préparation batch cooking : **2h le week-end** (épluchage, découpe, bases) + **30 min par soir** (cuisson, assemblage, finition)

### Niveau de connaissance requis
**Zéro.** L'app dit quoi manger et en quelle quantité. Les notions nutritionnelles (IG, fibres, antioxydants…) sont délivrées progressivement via les messages de Basile dans la gamification.

---

## 7. Données collectées

### Données obligatoires à l'onboarding

| Donnée | Utilité |
|---|---|
| Âge, sexe | Calcul des besoins nutritionnels de base |
| Taille, poids | Calcul IMC automatique, quantités |
| Niveau d'activité physique | Ajustement des apports caloriques et protéiques |
| Pathologies déclarées | Adaptation des menus (ex : diabète → IG plus strict) |
| Allergies & restrictions | Exclusion des aliments incompatibles |
| Préférences alimentaires | Végétarien, vegan, halal, casher, sans porc |
| Région | Saisonnalité et localité des ingrédients |

### Données optionnelles (influencent les menus si renseignées)

| Donnée | Impact |
|---|---|
| Glycémie à jeun / HbA1c | Ajuste la tolérance aux index glycémiques élevés |
| Cholestérol / triglycérides | Réduit les graisses saturées dans les menus |

### Données non collectées
- Objectif de poids chiffré (pas une app de bodybuilding ou régime)
- Traitements médicaux précis (responsabilité médicale trop élevée)
- Objets connectés — phase 2 uniquement (balance, CGM, montres fitness)

### Avertissement systématique
> *"Heal est un outil de bien-être. Il ne remplace pas l'avis d'un médecin ou d'un diététicien. Les informations que vous saisissez permettent de personnaliser vos menus, non d'établir un diagnostic."*

---

## 8. Fonctionnement cœur de l'app

### Flux principal

```
Profil utilisateur (onboarding)
        ↓
Ingrédients déjà disponibles ? (optionnel)
        ↓
Génération du planning semaine
(petit-déjeuner, déjeuner, dîner, collations)
        ↓
Liste de courses (ingrédients manquants uniquement)
        ↓
Guide batch cooking
(tâches du week-end 2h + tâches quotidiennes 30 min)
        ↓
Validation des repas pris
(1 clic, photo IA, ou recherche textuelle)
        ↓
Score nutritionnel + message d'encouragement Basile
        ↓
Rapport hebdomadaire automatique
```

### Contrôle glycémique — approche combinée

1. **Index glycémique (IG) et charge glycémique (CG)** de chaque repas
2. **Combinaisons alimentaires** : fibres + protéines + glucides ensemble pour ralentir l'absorption
3. **Ordre des aliments suggéré** dans le repas : légumes → protéines → glucides
4. **Jeûne intermittent** proposé si le profil utilisateur le justifie

### Santé globale — au-delà de la glycémie
Les menus visent également :
- **Collagène** (bouillons, mijotés longue cuisson) → articulations, peau
- **Antioxydants** (fruits et légumes de saison colorés) → protection cellulaire
- **Oméga-3** (poissons gras locaux de saison) → cardiovasculaire, inflammation
- **Fibres** (légumineuses, légumes) → microbiote, satiété

### Lecture complémentaire — diététique traditionnelle chinoise (MTC)
Chaque aliment de la base de données porte, en plus de ses données nutritionnelles occidentales, deux attributs issus de la diététique chinoise :
- **Nature énergétique** : froid / frais / neutre / tiède / chaud (ex : concombre = froid, gingembre = chaud, riz = neutre)
- **Saveur** : acide / amer / doux / piquant / salé, associée aux 5 éléments et aux organes correspondants (§4)

**Comment ça influence les menus (v1) :**
1. Les règles nutritionnelles occidentales (IG/CG, pathologies, allergies) restent **prioritaires et non négociables** — la MTC n'exclut jamais un aliment déjà validé par elles
2. À règles occidentales égales, la génération **favorise légèrement** les aliments dont la nature énergétique correspond à la saison (tiède/chaud l'hiver, frais/froid l'été) — un nudge, pas un filtre strict
3. Basile peut glisser une explication MTC en plus de l'explication nutritionnelle dans ses messages post-repas (*"Le gingembre est un aliment 'chaud' en diététique chinoise — parfait pour réchauffer l'organisme en hiver, et ses propriétés anti-inflammatoires sont aussi reconnues en nutrition moderne."*)
4. Aucun score ou diagnostic MTC n'est affiché à l'utilisateur (pas de "score Yin-Yang") — c'est un habillage narratif et une pondération légère, pas un second système de notation à suivre en plus du score glycémique

---

## 9. Gestion des menus & repas

### Granularité
- Planning à la **semaine complète** : petit-déjeuner, déjeuner, dîner, collations
- Jeûne intermittent proposé si pertinent pour le profil (remplace les collations)
- Pas de variation par budget — les menus visent naturellement des aliments accessibles (légumes de saison, viandes mijotées économiques mais nutritives)

### Recettes
L'app **ne génère pas les recettes pas à pas** — elle gère :
- Les assemblages et combinaisons d'ingrédients
- Les quantités personnalisées selon le profil
- Le séquencement batch cooking (ce qui se prépare le week-end vs. chaque soir)

L'utilisateur consulte les recettes détaillées sur des sites tiers, en respectant les ingrédients définis par Heal.

### Restrictions alimentaires gérées
- Allergies : gluten, lactose, fruits à coque, œufs, crustacés…
- Préférences : végétarien, vegan, halal, casher, sans porc
- Dégoûts personnels : liste d'aliments à exclure (saisie libre)

### Guide batch cooking
Structure type d'une semaine :

| Moment | Durée | Tâches |
|---|---|---|
| Week-end (dimanche) | ~2h | Épluchage, découpe, marinades, cuissons longues (four, mijoteuse), bases de sauces |
| Chaque soir | ~30 min | Cuisson des protéines, assemblage, finition, réchauffage |
| Cuissons longues programmées | Passives | Viandes en sauce, bouillons, légumineuses — ne comptent pas dans les 2h |

---

## 10. Saisonnalité & Localité

### Définition de "local"
- France + pays limitrophes (Espagne, Italie, Belgique, Suisse, Allemagne)
- Région choisie **manuellement** par l'utilisateur à l'onboarding

### Base de données saisonnière
- **Base statique** construite une fois, maintenue manuellement
- Calendrier de saisonnalité par région française + pays limitrophes
- Tous les fruits et légumes disponibles localement, organisés par mois et région
- Source de référence : données agronomiques publiques françaises

### Règles de saisonnalité dans les menus
- L'app **ne propose jamais** d'aliments hors saison de sa propre initiative
- Si l'utilisateur impose un aliment hors saison dans ses disponibilités : l'app l'intègre avec un badge discret "hors saison 🌍" et propose une alternative saisonnière
- Aucun blocage strict : l'utilisateur garde le contrôle

### Producteurs locaux — état de l'art & approche retenue
Recherche menée en amont : il **n'existe pas de base de données nationale unifiée** (producteurs × produits × géolocalisation) en accès libre en France. L'écosystème est fragmenté :

| Source | Ce qu'elle couvre | Limite |
|---|---|---|
| **Agrilocal** (36 départements) | Producteurs en circuits-courts, mis en relation avec des acheteurs | Conçu pour les acheteurs **publics** (cantines, collectivités), pas pour du grand public |
| **data.gouv.fr** — jeux "Producteurs en circuits-courts" / "Carnet des producteurs" | Données ouvertes, gratuites | Couverture très locale et incomplète, pas de mise à jour garantie |
| Portails **OpenDataSoft** par collectivité (ex. agglomération de Dunkerque) | Annuaires de producteurs locaux | Un jeu de données différent par collectivité, aucune API centralisée |
| **La Ruche qui dit Oui**, **Bienvenue à la ferme** | Réseaux de producteurs actifs et déjà connus du grand public | Pas d'API publique documentée à ce jour |

**Décision produit :**
- **v1 :** pas de promesse d'inventaire producteur en temps réel. La liste de courses (§9) affiche plutôt un lien contextuel *"Trouver un producteur près de chez vous"* qui pointe, selon la région de l'utilisateur, vers la ressource la plus pertinente disponible (Agrilocal, Bienvenue à la ferme, marché de producteurs local)
- **v2 :** agrégation *best-effort* des portails open data régionaux au fur et à mesure de leur disponibilité, et exploration d'un partenariat data avec Agrilocal ou La Ruche qui dit Oui (cf. §13, pistes business déjà identifiées)
- Construire et maintenir une base producteurs × produits fiable et à jour à l'échelle nationale serait un projet à part entière (couverture géographique, fraîcheur des données) — volontairement hors scope du MVP

---

## 11. Expérience utilisateur & Gamification

### Modes de saisie des repas (par ordre de préférence)

1. **Validation en 1 clic** du menu proposé par l'app (cas principal)
2. **Photo du repas** avec reconnaissance IA (si repas différent du menu)
3. **Recherche textuelle** dans la base d'aliments

### Gamification

| Mécanisme | Description |
|---|---|
| Points & badges | Attribués à chaque repas validé, selon la qualité nutritionnelle |
| Streaks | Jours consécutifs de menus respectés |
| Messages éducatifs | Chaque encouragement de Basile explique le *pourquoi* nutritionnel |
| Rapport hebdomadaire | Score glycémique estimé, diversité alimentaire, progression |

**Pas de classement social** — l'alimentation est intime et personnelle.

### Feedback & suivi
- **Tableau de bord glycémique estimé** (calculé à partir des IG/CG des repas)
- **Score de qualité nutritionnelle** maison (antioxydants, fibres, protéines, oméga-3…)
- **Rapport hebdomadaire automatique** avec message de Basile
- Pas de courbe de poids — l'objectif n'est pas la minceur mais la santé

### Exemple de message Basile post-repas
> *"Excellent ! Tes haricots verts t'ont apporté des fibres solubles qui ont ralenti l'absorption du riz complet. Ton pancréas a eu une soirée tranquille. 🦡 +12 points Heal !"*

---

## 12. Architecture technique

### Stack recommandée

| Composant | Technologie | Coût estimé/mois |
|---|---|---|
| Frontend mobile | React Native (iOS + Android) | — |
| Backend & BDD | Supabase (PostgreSQL, auth, stockage) | ~25 € |
| IA génération menus | Claude API (Sonnet) ou Gemini 1.5 Flash | ~30–80 € |
| IA reconnaissance photo | Google Vision ou Claude Vision | ~10–20 € |
| Base saisonnière | JSON statique maison | 0 € |
| Hébergement | Scaleway HDS (conformité données santé) | ~15–30 € |
| **Total infra estimé** | | **~80–155 €/mois** |

### Phases de développement

| Phase | Fonctionnalités | Objets connectés |
|---|---|---|
| **V1 — MVP** | Profil, planning semaine, liste de courses, batch cooking, gamification de base | Saisie manuelle uniquement |
| **V2** | IA photo repas, personnalisation apprise, rapport avancé | Connexion appli santé native (Apple Health, Google Fit) |
| **V3** | CGM (Dexcom, Freestyle Libre), balance connectée, montres fitness | Intégration complète objets connectés |

### Personnalisation

- **V1 :** Personnalisation statique — formulaire initial + règles fixes
- **V2+ :** Apprentissage progressif — l'app apprend les préférences et les réponses glycémiques estimées au fil du temps

---

## 13. Modèle économique

### Offres

| Phase | Offre | Prix |
|---|---|---|
| J0 → J30 | Essai gratuit — toutes fonctionnalités | 0 € |
| Après 30j | Abonnement mensuel | **6,99 €/mois** |
| Après 30j | Abonnement annuel | **49,99 €/an** (~4,17 €/mois) |

### Analyse de rentabilité

| Indicateur | Valeur |
|---|---|
| Coût infra mensuel max | ~155 €/mois |
| Seuil de rentabilité | ~23 abonnés mensuels |
| Revenus à 500 abonnés mensuels | ~3 495 €/mois |
| Revenus à 1 000 abonnés annuels | ~4 165 €/mois |

### Pistes d'évolution business (phase 2+)
- Partenariats AMAP et marchés locaux — pistes concrètes identifiées : **Agrilocal**, **La Ruche qui dit Oui**, **Bienvenue à la ferme** (cf. §10) — accès data et/ou paniers livrés depuis l'app
- Partenariats mutuelles santé (remboursement abonnement)
- Version Pro pour diététiciens (suivi de patients)

---

## 14. Aspects légaux & RGPD

### Positionnement légal
**Outil de bien-être** — pas un dispositif médical.
- Évite la réglementation dispositif médical CE classe IIa/IIb
- Avertissement médical systématique sur tous les écrans sensibles
- Recommandation explicite de consulter un professionnel de santé

### Données de santé & RGPD

| Point | Obligation | Recommandation |
|---|---|---|
| Données pathologies / glycémie | Données sensibles art. 9 RGPD | Consentement explicite obligatoire, séparé des CGU |
| Hébergement | HDS recommandé dès que pathologies stockées | Scaleway ou OVHcloud HDS |
| Droit à l'oubli | Obligatoire | Suppression compte + toutes données sur simple demande |
| Transferts hors UE | Encadré RGPD | Privilégier hébergeurs européens |
| Politique de confidentialité | Obligatoire | Langage clair, non juridique, accessible depuis l'app |

### Mentions obligatoires dans l'app
> *"Heal est un outil de bien-être personnel. Il ne constitue pas un avis médical et ne remplace pas la consultation d'un médecin, d'un diététicien ou de tout autre professionnel de santé. En cas de pathologie, consultez votre médecin avant de modifier votre alimentation."*

---

## 15. Différenciateurs & Positionnement

### Par ordre de priorité stratégique

| Priorité | Différenciateur | Détail |
|---|---|---|
| 🥇 | **Facilité absolue** | Planning généré, liste de courses prête, batch cooking guidé. Zéro effort de réflexion pour l'utilisateur |
| 🥈 | **Saisonnalité & localité** | Aucun concurrent ne le fait. Ancrage fort dans une tendance de fond |
| 🥉 | **Santé globale** | IG + antioxydants + collagène + oméga-3 (nutrition moderne) **et** nature énergétique + saveur (diététique chinoise) — pas juste les calories |
| 4 | **Personnalisation progressive** | S'améliore avec le temps et les retours utilisateur |
| 5 | **Éducation non intrusive** | Les connaissances nutritionnelles passent par Basile, jamais par des cours |

### Ce qu'Heal n'est pas
- ❌ Un compteur de calories
- ❌ Une app de régime ou de perte de poids
- ❌ Un réseau social alimentaire
- ❌ Un dispositif médical
- ❌ Une app de livraison de repas

---

## Prochaines étapes

- [ ] Vérifier la disponibilité du nom "Heal" (INPI, domaines, stores) avant dépôt — cf. §3, plan B si conflit
- [ ] Créer le MVP fonctionnel (définir les écrans clés)
- [ ] Construire la base de données saisonnière (calendrier par région)
- [ ] Enrichir la base d'aliments avec les attributs MTC (nature énergétique, saveur) — cf. §8
- [ ] Prototyper l'onboarding et le planning semaine
- [ ] Commander les premières illustrations de Basile (brief designer)
- [ ] Réserver le nom de domaine `heal.fr` / `heal.app` (ou plan B si indisponible)
- [ ] Définir l'architecture de la base de données Supabase

---

*Document rédigé dans le cadre du cadrage initial du projet Heal — Mai 2026.*
