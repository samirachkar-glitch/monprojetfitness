# Suivi Fitness — installation sur Vercel

Cette version est prête à être déployée directement sur Vercel. L'application reste une PWA installable sur iPhone/Android et la clé OpenAI reste côté serveur.

## 1. Créer le projet Vercel

1. Va sur https://vercel.com et connecte-toi.
2. Crée un nouveau projet.
3. Importe ce dossier via un dépôt GitHub/GitLab/Bitbucket, ou utilise la CLI Vercel.
4. Aucun framework particulier n'est nécessaire : le site est statique et le dossier `api/` contient la fonction serveur.

## 2. Ajouter la clé OpenAI

Dans Vercel :

**Project → Settings → Environment Variables**

Ajoute :

- `OPENAI_API_KEY` = ta clé API OpenAI
- `OPENAI_MODEL` = `gpt-5-mini` (facultatif, tu peux changer de modèle plus tard)

Active au minimum la variable pour **Production**. Tu peux aussi l'activer pour Preview/Development.

Ne mets jamais la clé directement dans `index.html`.

## 3. Déployer

Clique sur **Deploy**. Une fois terminé, Vercel fournit une adresse HTTPS du type :

`https://ton-projet.vercel.app`

L'application appelle automatiquement :

`/api/analyze-meal`

Aucune URL de serveur à modifier dans l'app.

## 4. Installer sur téléphone

### iPhone

1. Ouvre l'adresse Vercel dans **Safari**.
2. Appuie sur **Partager**.
3. Choisis **Sur l'écran d'accueil**.
4. Confirme avec **Ajouter**.

### Android

1. Ouvre l'adresse Vercel dans **Chrome**.
2. Ouvre le menu `⋮`.
3. Choisis **Installer l'application** ou **Ajouter à l'écran d'accueil**.

## 5. Tester l'IA

Dans la partie nutrition, écris par exemple :

`2 œufs, une banane, 30 g de whey et 250 ml de lait demi-écrémé`

Puis appuie sur **Analyser et ajouter**.

L'app doit recevoir les aliments, quantités, kcal, protéines, glucides et lipides puis les ajouter au journal.

## Fichiers importants

- `index.html` : application
- `manifest.json` : configuration PWA
- `sw.js` : fonctionnement PWA/cache
- `api/analyze-meal.js` : fonction Vercel sécurisée qui appelle OpenAI
- `.env.example` : exemple des variables d'environnement
- `vercel.json` : configuration Vercel

## Sécurité

La clé API n'est jamais envoyée au navigateur. Elle est uniquement lue par la fonction Vercel via `process.env.OPENAI_API_KEY`.

Les estimations nutritionnelles de l'IA sont indicatives. Pour un suivi précis, privilégie les quantités pesées et les informations nutritionnelles des emballages.

## Version diagnostic IA (correctif 502)
Cette version affiche directement dans l'app le code utile renvoyé par OpenAI (401, 400, 429, etc.) sans exposer la clé API. Le schéma Structured Outputs a aussi été simplifié pour maximiser la compatibilité avec l'API Responses.

Après remplacement des fichiers sur Vercel, effectuez un nouveau déploiement. Si l'analyse échoue encore, copiez uniquement le message affiché dans l'app (jamais votre clé API).
