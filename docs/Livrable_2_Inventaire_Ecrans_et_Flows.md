# Heal — Inventaire des Écrans & Flows de Navigation

**Version :** 1.1  
**Date :** Mai 2026 (v1.1 : Août 2026)  
**Total écrans :** 48

> **v1.1 — Changelog :** renommage Harméal → Heal ; écran 19 enrichi (badge nature MTC) ; écran 21 enrichi (lien producteurs locaux) ; écran 44 enrichi (nature MTC par aliment). Aucun écran ajouté ou supprimé.

---

## Conventions

| Symbole | Signification |
|---|---|
| → | Navigation directe (tap) |
| ⇒ | Navigation conditionnelle |
| ↩ | Retour arrière |
| 🔒 | Écran réservé aux abonnés (essai ou payant) |
| ⚠️ | Point d'attention UX |

---

## Arborescence complète

```
APP
├── AUTHENTIFICATION
│   ├── 01. Splash screen
│   ├── 02. Welcome / Onboarding marketing
│   ├── 03. Connexion
│   ├── 04. Inscription
│   ├── 05. Confirmation email
│   └── 06. Mot de passe oublié
│
├── ONBOARDING PROFIL (post-inscription)
│   ├── 07. Étape 1 — Données physiologiques
│   ├── 08. Étape 2 — Niveau d'activité
│   ├── 09. Étape 3 — Pathologies
│   ├── 10. Étape 4 — Allergies & restrictions
│   ├── 11. Étape 5 — Préférences alimentaires
│   ├── 12. Étape 6 — Région
│   ├── 13. Étape 7 — Données biologiques (optionnel)
│   ├── 14. Récapitulatif profil
│   └── 15. Bienvenue Basile (fin onboarding)
│
├── NAVIGATION PRINCIPALE (Tab bar)
│   ├── 🏠 HOME
│   │   └── 16. Dashboard / Home
│   │
│   ├── 📅 PLANNING
│   │   ├── 17. Planning semaine 🔒
│   │   ├── 18. Détail journée 🔒
│   │   ├── 19. Détail repas 🔒
│   │   └── 20. Swap repas 🔒
│   │
│   ├── 🛒 COURSES
│   │   ├── 21. Liste de courses 🔒
│   │   └── 22. Édition liste de courses 🔒
│   │
│   ├── 🍳 BATCH COOKING
│   │   ├── 23. Guide week-end 🔒
│   │   └── 24. Guide quotidien (soir) 🔒
│   │
│   └── 👤 PROFIL
│       ├── 25. Mon profil
│       ├── 26. Édition profil
│       ├── 27. Gestion allergies & restrictions
│       ├── 28. Paramètres notifications
│       ├── 29. Jeûne intermittent
│       ├── 30. Abonnement & paiement
│       ├── 31. CGU
│       ├── 32. Politique de confidentialité
│       ├── 33. Suppression de compte
│       └── 34. FAQ / Aide
│
├── VALIDATION REPAS (modales/flux)
│   ├── 35. Validation 1 clic + message Basile 🔒
│   ├── 36. Capture photo repas 🔒
│   ├── 37. Confirmation aliments reconnus 🔒
│   └── 38. Recherche textuelle aliments 🔒
│
├── GAMIFICATION
│   ├── 39. Collection de badges 🔒
│   ├── 40. Historique des points 🔒
│   └── 41. Détail streak 🔒
│
├── RAPPORTS
│   ├── 42. Rapport hebdomadaire 🔒
│   └── 43. Historique des rapports 🔒
│
├── SAISONNALITÉ
│   └── 44. Calendrier de saison 🔒
│
└── ABONNEMENT
    ├── 45. Paywall (fin d'essai)
    ├── 46. Écran paiement
    └── 47. Confirmation abonnement
    
    + 48. Écran d'erreur générique (réseau, API…)
```

---

## Détail de chaque écran

---

### 01. Splash Screen
**Type :** Écran de lancement (automatique, 2s max)  
**Contenu :**
- Logo Heal centré (Basile + nom)
- Fond crème `#F5EDD8`
- Animation : Basile cligne des yeux, toque se pose

**Navigation :**
- ⇒ Écran 03 (Connexion) si session existante valide
- ⇒ Écran 02 (Welcome) si première ouverture / session expirée

---

### 02. Welcome / Onboarding Marketing
**Type :** Carrousel (3–4 slides swipables)  
**Contenu par slide :**
1. Basile présente l'app : *"Des menus de saison, pensés pour votre corps"*
2. *"2h le dimanche, 30 min chaque soir — c'est tout"*
3. *"Heal apprend à vous connaître semaine après semaine"*
4. *"30 jours gratuits, sans carte bancaire"*

**Actions :**
- Bouton "Créer mon compte" → Écran 04
- Lien "J'ai déjà un compte" → Écran 03
- Possibilité de passer le carrousel (bouton "Passer")

---

### 03. Connexion
**Type :** Écran formulaire  
**Contenu :**
- Logo Heal
- Champ email
- Champ mot de passe (œil pour afficher)
- Bouton "Se connecter"
- Séparateur "ou"
- Bouton Apple Login (fond noir, obligatoire sur iOS)
- Bouton Google Login
- Bouton Microsoft Login
- Bouton Facebook Login
- Lien "Mot de passe oublié ?" → Écran 06
- Lien "Créer un compte" → Écran 04

**Navigation :**
- ⇒ Écran 07 si profil non complété
- ⇒ Écran 16 si profil complété et abonnement actif
- ⇒ Écran 45 si profil complété et essai expiré

---

### 04. Inscription
**Type :** Écran formulaire  
**Contenu :**
- Champ prénom
- Champ email
- Champ mot de passe + confirmation
- Checkbox RGPD (lien vers CGU + politique de confidentialité) — obligatoire
- Bouton "Créer mon compte"
- Séparateur "ou"
- Boutons login social (Apple / Google / Microsoft ou Facebook)
- Lien "J'ai déjà un compte" → Écran 03

**⚠️ UX :** Le bouton de soumission reste grisé tant que le RGPD n'est pas accepté.

---

### 05. Confirmation Email
**Type :** Écran informatif  
**Contenu :**
- Illustration de Basile avec une enveloppe
- *"Un email vous a été envoyé à [email masqué]. Cliquez sur le lien pour confirmer votre compte."*
- Bouton "Renvoyer l'email"
- Lien "Modifier mon adresse email"

---

### 06. Mot de Passe Oublié
**Type :** Écran formulaire simple  
**Contenu :**
- Champ email
- Bouton "Envoyer le lien"
- Message de confirmation (même texte que l'email soit connu ou non — sécurité)
- ↩ Retour vers connexion

---

### 07. Onboarding — Étape 1 : Données physiologiques
**Type :** Formulaire multi-champs avec barre de progression (1/7)  
**Contenu :**
- Message Basile : *"Pour commencer, parlez-moi un peu de vous !"*
- Champ : Date de naissance (date picker)
- Champ : Sexe (sélecteur : Homme / Femme / Non-binaire / Préfère ne pas dire)
- Champ : Taille en cm (slider + saisie directe)
- Champ : Poids en kg (spinner + saisie directe)
- Bandeau de consentement données de santé (checkbox + lien politique)
- Bouton "Suivant"

---

### 08. Onboarding — Étape 2 : Niveau d'activité
**Type :** Sélecteur à 4 options visuelles (1/7 → 2/7)  
**Contenu :**
- Message Basile : *"Votre niveau d'activité m'aide à doser les bonnes quantités."*
- 4 cartes avec icône + titre + description concrète :
  - 🪑 Sédentaire — *"Je travaille assis, peu de marche"*
  - 🚶 Légèrement actif — *"Marche 30 min/jour ou sport 1–2×/semaine"*
  - 🚴 Modérément actif — *"Sport 3–4×/semaine ou travail physique modéré"*
  - 🏋️ Très actif — *"Sport intensif quotidien ou travail physique intensif"*

---

### 09. Onboarding — Étape 3 : Pathologies
**Type :** Liste à cocher avec avertissement médical (3/7)  
**Contenu :**
- Message Basile : *"Ces informations me permettent d'adapter vos menus. Elles ne remplacent pas votre médecin."*
- Bandeau avertissement médical (orange doux)
- Liste de pathologies avec cases à cocher (sélection multiple)
- Option "Aucune" (décoche tout)

---

### 10. Onboarding — Étape 4 : Allergies & restrictions
**Type :** Grille de sélection (4/7)  
**Contenu :**
- Message Basile : *"Indiquez vos allergies — je les respecterai à la lettre."*
- Section "Allergies" (badges à activer) : gluten, lactose, œufs, fruits à coque, arachides, poisson, crustacés, soja, sésame, céleri, moutarde, sulfites
- Section "Préférences" : végétarien, vegan, halal, casher, sans porc, sans alcool en cuisine
- Champ texte libre : "Autres aliments à éviter" (dégoûts personnels)

---

### 11. Onboarding — Étape 5 : Préférences alimentaires
**Type :** Sélecteur d'aliments (5/7)  
**Contenu :**
- Message Basile : *"Y a-t-il des aliments que vous adorez et que je devrais privilégier ?"*
- Recherche + grille d'aliments à "aimer" (optionnel)
- Ces aliments seront favorisés dans la génération des menus

---

### 12. Onboarding — Étape 6 : Région
**Type :** Liste déroulante (6/7)  
**Contenu :**
- Message Basile : *"Ma base de données saisonnière est organisée par région. Où vivez-vous ?"*
- Liste déroulante : 13 régions françaises + Belgique, Suisse, Luxembourg, Espagne, Italie, Allemagne
- Explication courte : *"Votre région détermine les fruits et légumes de saison disponibles près de chez vous."*

---

### 13. Onboarding — Étape 7 : Données biologiques (optionnel)
**Type :** Formulaire optionnel (7/7)  
**Contenu :**
- Message Basile : *"Si vous avez des résultats d'analyses récents, je peux affiner encore plus vos menus. C'est totalement optionnel."*
- Champs optionnels :
  - Glycémie à jeun (g/L) — plage normale affichée
  - HbA1c (%) — plage normale affichée
  - Cholestérol total (g/L)
  - Triglycérides (g/L)
- Avertissement : *"Ces données ne constituent pas un diagnostic médical."*
- Bouton "Passer cette étape" bien visible

---

### 14. Récapitulatif Profil
**Type :** Écran de synthèse (fin onboarding)  
**Contenu :**
- Résumé de toutes les informations saisies (lecture seule)
- Bouton "Modifier" sur chaque section
- Bouton "C'est parti !" → Écran 15

---

### 15. Bienvenue Basile
**Type :** Écran d'accueil animé (post-onboarding)  
**Contenu :**
- Grande animation de Basile (content, toque bien droite)
- *"Bienvenue dans Heal, [Prénom] ! Je prépare votre premier planning…"*
- Animation de chargement pendant la génération du premier planning
- Transition automatique → Écran 16 une fois le planning prêt

---

### 16. Dashboard / Home 🔒
**Type :** Écran principal avec sections empilées  
**Contenu :**
- En-tête : Basile saisonnier + message du jour + date
- Carte "Prochain repas" : nom du repas + heure + bouton validation 1 clic
- Carte "Streak" : nombre de jours + flamme animée
- Carte "Semaine en cours" : mini-vue 7 jours (points colorés = repas validés)
- Carte "Saison du mois" : 3 légumes/fruits phares du mois
- Lien "Voir le rapport de la semaine dernière" (si disponible)

---

### 17. Planning Semaine 🔒
**Type :** Vue calendrier hebdomadaire  
**Contenu :**
- Navigation semaine (← semaine précédente / semaine suivante →)
- Vue 7 colonnes (L/Ma/Me/J/V/Sa/Di)
- Chaque jour : 4 cases (Petit-déj / Déjeuner / Collation / Dîner)
- Chaque case : nom court du repas + icône de validation (✓ si validé / ○ si à venir)
- Bouton "Régénérer le planning" (confirmation requise)
- Bouton "Ajouter des ingrédients disponibles"
- Indicateur saisonnier dans l'en-tête

**Navigation :**
- Tap sur une case repas → Écran 18 (Détail journée)

---

### 18. Détail Journée 🔒
**Type :** Écran liste (4 repas du jour)  
**Contenu :**
- Date + message Basile du jour
- 4 cartes repas : Petit-déjeuner / Déjeuner / Collation / Dîner
- Chaque carte : nom du repas + ingrédients principaux (3 max) + bouton validation
- Score glycémique estimé de la journée (barre colorée)
- Accès au guide quotidien du soir (bouton)

**Navigation :**
- Tap sur une carte → Écran 19 (Détail repas)

---

### 19. Détail Repas 🔒
**Type :** Écran détail  
**Contenu :**
- Nom du repas + type (déjeuner, dîner…)
- Score glycémique estimé du repas (faible 🟢 / modéré 🟡 / élevé 🔴)
- Badge discret "nature MTC" du repas (ex. ❄️ Rafraîchissant / 🔥 Réchauffant / ⚖️ Neutre) — tag informatif, pas un second score
- Section "Ingrédients & quantités" :
  - Liste avec quantité en grammes + équivalent concret (ex : "2 carottes moyennes")
  - Badge "hors saison 🌍" si applicable
- Section "Ordre de consommation" :
  - 1️⃣ Légumes d'abord
  - 2️⃣ Protéines
  - 3️⃣ Féculents
- Valeurs nutritionnelles : protéines / glucides / lipides / fibres
- Message éducatif de Basile (pourquoi ce repas est bon), avec parfois un éclairage complémentaire de diététique chinoise sur un ingrédient
- Bouton "J'ai mangé ça ✓" (validation 1 clic)
- Bouton "Remplacer ce repas" → Écran 20
- Lien "Chercher la recette" (ouverture navigateur externe avec recherche pré-remplie)

---

### 20. Swap Repas 🔒
**Type :** Modale de confirmation + chargement  
**Contenu :**
- *"Basile cherche une alternative pour [nom du repas]…"*
- Animation de chargement (Basile qui réfléchit)
- Affichage du nouveau repas proposé avec ses ingrédients
- Bouton "Garder cette proposition"
- Bouton "En proposer une autre" (max 3 tentatives)
- Bouton "Annuler — garder le repas actuel"

---

### 21. Liste de Courses 🔒
**Type :** Liste organisée par catégories  
**Contenu :**
- En-tête : semaine en cours + nombre d'articles restants
- Bouton "Partager la liste"
- Bouton "Modifier la liste" → Écran 22
- Lien "Trouver un producteur près de chez vous" (ouverture navigateur externe, ressource selon la région — US-034)
- Sections par catégorie :
  - 🥕 Légumes & Fruits
  - 🥩 Protéines (viandes, poissons, œufs)
  - 🧀 Produits laitiers
  - 🌾 Épicerie sèche (céréales, légumineuses…)
  - 🌿 Herbes & Épices
- Chaque article : nom + quantité + case à cocher
- Articles cochés : grisés et déplacés en bas
- Bouton "Tout décocher"

---

### 22. Édition Liste de Courses 🔒
**Type :** Écran d'édition  
**Contenu :**
- Liste complète en mode édition
- Swipe gauche sur un article → suppression
- Champ d'ajout rapide en bas : texte + quantité + bouton "+"
- Bouton "Valider les modifications"
- ⚠️ UX : avertissement si régénération du planning (les ajouts manuels pourraient être perdus)

---

### 23. Guide Batch Cooking Week-end 🔒
**Type :** Liste de tâches ordonnées  
**Contenu :**
- En-tête : durée estimée totale (hors cuissons passives) + message Basile
- Section "À lancer en premier (cuissons passives)" :
  - Ex : "Mijoté de bœuf — 3h au four à 160°C" (badge ⏱️ Passif)
- Section "Préparation active (~2h)" :
  - Tâches ordonnées logiquement
  - Chaque tâche : action + aliments concernés + durée estimée + case à cocher
- Minuterie intégrée par tâche (tap pour lancer)
- Progression globale (barre de progression)
- Message de Basile à la fin de toutes les tâches

---

### 24. Guide Quotidien (Soir) 🔒
**Type :** Liste de tâches courtes  
**Contenu :**
- En-tête : "Ce soir — [date]" + durée estimée (~30 min)
- Tâches listées chronologiquement :
  - Ce qu'il faut sortir du frigo/congélateur
  - Cuissons courtes
  - Assemblage
  - Finition / dressage
- Chaque tâche cochable
- Message de Basile une fois terminé : *"Votre repas est prêt ! N'oubliez pas de le valider."*
- Bouton de validation rapide depuis cet écran

---

### 25. Mon Profil
**Type :** Écran de synthèse  
**Contenu :**
- Avatar de Basile avec la saison du moment
- Prénom + email
- Résumé profil : âge, poids, région, niveau d'activité
- Résumé restrictions (badges)
- Statut abonnement (essai J+X ou abonné jusqu'au…)
- Liens vers les sous-sections de paramètres

---

### 26. Édition Profil
**Type :** Formulaire pré-rempli  
**Contenu :**
- Tous les champs de l'onboarding modifiables
- ⚠️ Avertissement si modification des données de santé : *"Modifier ces informations régénérera votre planning. Continuer ?"*

---

### 27. Gestion Allergies & Restrictions
**Type :** Grille de sélection (identique à l'onboarding étape 4)  
**Contenu :**
- Allergies actives (modifiables)
- Préférences actives (modifiables)
- Liste des dégoûts personnels avec option de suppression par article

---

### 28. Paramètres Notifications
**Type :** Liste de toggles  
**Contenu :**
- Toggle global (désactive toutes les notifications)
- Notification par notification avec horaire configurable :
  - Rappel validation dîner (défaut : 19h00)
  - Rappel liste de courses (défaut : vendredi 18h00)
  - Rappel batch cooking (défaut : dimanche 10h00)
  - Rapport hebdomadaire (défaut : dimanche 20h00)
  - Nouveaux badges (immédiat)
- Bouton "Tester la notification" (envoie une notification test)

---

### 29. Jeûne Intermittent
**Type :** Écran de configuration  
**Contenu :**
- Toggle "Activer le jeûne intermittent"
- Sélecteur de protocole :
  - 16:8 — Fenêtre alimentaire sur 8h (ex : 12h–20h)
  - 5:2 — 2 jours/semaine à 500 kcal
- Pour 16:8 : sélecteur de la fenêtre horaire (début / fin)
- Pour 5:2 : sélecteur des jours de restriction (ex : mardi + jeudi)
- Message informatif de Basile expliquant le protocole choisi
- ⚠️ Avertissement : *"Le jeûne intermittent n'est pas recommandé pour tout le monde. Consultez votre médecin si vous avez des doutes."*

---

### 30. Abonnement & Paiement
**Type :** Écran de gestion  
**Contenu :**
- Statut actuel : Essai (J restants) / Mensuel / Annuel
- Date de prochain renouvellement
- Montant
- Bouton "Passer à l'annuel" (si mensuel)
- Bouton "Gérer l'abonnement" (redirige vers App Store / Google Play / Stripe Portal)
- Historique des paiements (3 dernières factures)

---

### 31. CGU
**Type :** Écran texte défilant  
**Contenu :** Conditions Générales d'Utilisation complètes  
**Action :** Bouton "Retour" uniquement

---

### 32. Politique de Confidentialité
**Type :** Écran texte défilant  
**Contenu :** Politique de confidentialité complète + contact DPO  
**Action :** Bouton "Retour" uniquement

---

### 33. Suppression de Compte
**Type :** Écran de confirmation en 2 étapes  
**Contenu :**
- Étape 1 : Résumé des données qui seront supprimées + avertissement irréversibilité
- Étape 2 : Saisie du mot de passe pour confirmer
- Bouton "Supprimer définitivement mon compte" (rouge, en bas)
- Message final : *"Votre compte a été supprimé. Vos données seront effacées sous 30 jours."*

---

### 34. FAQ / Aide
**Type :** Liste accordéon  
**Sections :**
- Comment fonctionne la génération des menus ?
- Comment modifier mes allergies ?
- Comment annuler mon abonnement ?
- Que sont les données biologiques et à quoi servent-elles ?
- Comment fonctionne le batch cooking ?
- Lien "Contacter le support" (email)

---

### 35. Validation 1 Clic + Message Basile 🔒
**Type :** Modale animée (overlay)  
**Contenu :**
- Animation de Basile (heureux, toque qui saute)
- Message personnalisé sur le repas (aliment + bénéfice nutritionnel)
- Points gagnés (+XX points)
- Badge débloqué si applicable (confettis)
- Bouton "Super !" pour fermer

---

### 36. Capture Photo Repas 🔒
**Type :** Écran caméra  
**Contenu :**
- Viseur caméra avec guide de cadrage
- Bouton de capture
- Bouton "Choisir depuis la galerie"
- ↩ Annuler → retour au détail repas

---

### 37. Confirmation Aliments Reconnus 🔒
**Type :** Écran de validation IA  
**Contenu :**
- Photo prise (miniature)
- Liste des aliments détectés avec case à cocher (pour corriger)
- Champ pour ajouter un aliment non détecté
- Score nutritionnel estimé
- ⚠️ Si allergène détecté : bandeau d'avertissement orange
- Bouton "Valider ce repas"

---

### 38. Recherche Textuelle Aliments 🔒
**Type :** Écran de recherche  
**Contenu :**
- Barre de recherche avec auto-complétion
- Résultats en liste (nom + catégorie + IG)
- Sélection multiple : aliments sélectionnés apparaissent en chips en bas
- Pour chaque aliment sélectionné : saisie de la quantité (grammes ou mesure concrète)
- Bouton "Valider ce repas" → modale Basile

---

### 39. Collection de Badges 🔒
**Type :** Grille de badges  
**Contenu :**
- Badges débloqués (en couleur)
- Badges non débloqués (grisés avec condition affichée au survol/tap)
- Date de déblocage affichée pour chaque badge obtenu
- Total : X / 10 badges obtenus

---

### 40. Historique des Points 🔒
**Type :** Liste chronologique  
**Contenu :**
- Total de points en en-tête
- Historique par semaine : points gagnés + source (repas, bonus streak, badge)
- Graphique de barres hebdomadaires (4 dernières semaines)

---

### 41. Détail Streak 🔒
**Type :** Écran de suivi  
**Contenu :**
- Streak actuel (flamme + nombre de jours)
- Record personnel
- Calendrier des 30 derniers jours (jours validés en vert, manqués en gris)
- Règle rappelée : *"2 repas principaux validés = 1 jour compté"*

---

### 42. Rapport Hebdomadaire 🔒
**Type :** Écran de synthèse riche  
**Contenu :**
- En-tête : "Semaine du [date] — [prénom]"
- Score glycémique estimé (grand visuel couleur + barre)
- Score de diversité alimentaire (nombre de familles d'aliments)
- Repas validés : X / 28 possibles
- Top 3 repas de la semaine (selon score nutritionnel)
- Conseil personnalisé de Basile pour la semaine suivante
- Avertissement médical si pathologie déclarée
- Bouton "Voir le planning de la semaine prochaine"

---

### 43. Historique des Rapports 🔒
**Type :** Liste chronologique  
**Contenu :**
- 12 semaines de rapports conservés
- Chaque ligne : semaine + score glycémique résumé + repas validés
- Tap → Écran 42 (rapport de cette semaine)

---

### 44. Calendrier de Saison 🔒
**Type :** Vue mensuelle  
**Contenu :**
- Mois actuel (navigation ← →)
- Grille de fruits & légumes disponibles (icône + nom)
- Filtre : Légumes / Fruits / Tout
- Tap sur un aliment :
  - Bénéfice nutritionnel principal
  - Nature énergétique MTC (froid/frais/neutre/tiède/chaud) et saveur
  - Conseil de conservation
  - *"Utilisé dans votre planning cette semaine"* si applicable
- Région affichée en en-tête (modifiable via raccourci vers Profil)

---

### 45. Paywall (Fin d'Essai)
**Type :** Écran d'abonnement  
**Contenu :**
- Message de Basile : *"Votre essai est terminé. Continuez l'aventure !"*
- Rappel des bénéfices (3 points clés)
- Deux cartes d'offre :
  - Mensuelle : 6,99 €/mois
  - Annuelle : 49,99 €/an (mise en avant — économie 30% affichée)
- Bouton "Choisir l'annuel" (CTA principal)
- Bouton "Choisir le mensuel" (CTA secondaire)
- Lien "Restaurer un achat"
- Liens CGV et politique de confidentialité

---

### 46. Écran Paiement
**Type :** Formulaire Stripe / App Store natif  
**Contenu :** Délégué à Stripe Checkout (web) ou App Store/Google Play (mobile)

---

### 47. Confirmation Abonnement
**Type :** Écran de succès  
**Contenu :**
- Animation Basile (très heureux)
- *"Bienvenue dans l'aventure Heal ! Votre abonnement [type] est actif."*
- Bouton "Voir mon planning" → Écran 17

---

### 48. Écran d'Erreur Générique
**Type :** Écran de fallback  
**Contenu :**
- Illustration Basile (l'air désolé, toque de travers)
- *"Oups ! Basile a rencontré un problème. Vérifiez votre connexion et réessayez."*
- Bouton "Réessayer"
- Lien "Contacter le support"

---

## Flows de navigation principaux

### Flow 1 — Première utilisation
```
01 Splash → 02 Welcome → 04 Inscription → 05 Confirmation email
→ 03 Connexion → 07→08→09→10→11→12→13 Onboarding (7 étapes)
→ 14 Récapitulatif → 15 Bienvenue Basile → 16 Home
```

### Flow 2 — Utilisation quotidienne (repas conforme)
```
16 Home → tap "Prochain repas" → 19 Détail repas
→ tap "J'ai mangé ça ✓" → 35 Modale Basile → 16 Home
```

### Flow 3 — Utilisation quotidienne (repas différent)
```
16 Home → 19 Détail repas → tap "Valider par photo"
→ 36 Capture photo → 37 Confirmation aliments → 35 Modale Basile → 16 Home
```

### Flow 4 — Préparation week-end
```
16 Home → 21 Liste de courses (vendredi)
→ [Samedi courses effectuées]
→ 23 Guide batch cooking (dimanche) → tâches cochées → message Basile
```

### Flow 5 — Fin d'essai
```
03 Connexion → ⇒ 45 Paywall → 46 Paiement → 47 Confirmation → 16 Home
```

### Flow 6 — Rapport hebdomadaire
```
Notification push (dimanche 20h) → 42 Rapport hebdomadaire
→ "Voir planning semaine prochaine" → 17 Planning semaine
```

---

## Récapitulatif

| Catégorie | Nb écrans |
|---|---|
| Authentification | 6 |
| Onboarding profil | 9 |
| Navigation principale | 11 |
| Gestion profil & paramètres | 9 |
| Validation repas | 4 |
| Gamification | 3 |
| Rapports | 2 |
| Saisonnalité | 1 |
| Abonnement | 3 |
| **Total** | **48** |

---

*Livrable 2 / 7 — Heal — Mai 2026*
