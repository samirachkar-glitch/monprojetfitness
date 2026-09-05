# Connexion IA — Suivi Fitness Complet

La saisie de repas en langage naturel utilise un endpoint serveur `/api/analyze-meal`. La clé OpenAI reste sur le serveur et n'est jamais envoyée ni enregistrée dans le navigateur/PWA.

## Lancer localement

1. Installer Node.js 18 ou plus récent.
2. Définir la variable d'environnement `OPENAI_API_KEY`.
3. Facultatif : définir `OPENAI_MODEL` (par défaut `gpt-5-mini`).
4. Dans ce dossier, lancer `npm start`.
5. Ouvrir `http://localhost:3000`.

Exemple macOS/Linux :

    OPENAI_API_KEY="votre-cle" npm start

PowerShell :

    $env:OPENAI_API_KEY="votre-cle"
    npm start

## Déploiement

Déployer le dossier sur un hébergeur capable d'exécuter Node.js, puis ajouter `OPENAI_API_KEY` dans les variables d'environnement/secrets de l'hébergeur. Ne jamais écrire la clé dans `index.html`, `sw.js`, Git ou localStorage.

L'utilisation de l'API OpenAI est facturée séparément selon votre compte API et le modèle utilisé.
