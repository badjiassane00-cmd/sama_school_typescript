# Sama School API

API TypeScript/Express avec base MySQL et Sequelize.

## Démarrage

1. Installer les dépendances : `npm install`
2. Copier `.env.example` vers `.env` et configurer la base de données ainsi que `JWT_SECRET`.
3. Appliquer les migrations : `npm run db:migrate`
4. Compiler et lancer l'API : `npm run build` puis `npm start`

Les tests utilisent `.env.test` et une base dédiée dont le nom doit se terminer par `_test` :

```sh
npm test
```

Les tests s'exécutent en série, car chaque suite réinitialise la base de test.

## Fonctionnalités et routes

- `POST /register` et `POST /auth/register` : inscription et création du profil.
- `POST /login` et `POST /auth/login` : connexion, émission des tokens.
- `GET /me` : informations de l'utilisateur connecté (Bearer access token requis).
- `POST /auth/refresh` et `POST /auth/logout` : renouvellement et révocation de session.
- `POST /courses`, `GET /courses/:id`, `PATCH /courses/:id` : gestion de cours par les rôles autorisés.

L'authentification inclut les rôles `ADMIN`, `TEACHER` et `LEARNER`, le hachage des mots de passe, la limitation des tentatives et la journalisation des connexions.

## Stratégie Git

- `main` contient les versions stables.
- Créer une branche `feat/<sujet>` ou `fix/<sujet>` pour chaque changement.
- Utiliser des messages [Conventional Commits](https://www.conventionalcommits.org/) : `feat(auth): ...`, `fix(courses): ...`, `docs: ...`.
- Créer un tag annoté SemVer (`vMAJOR.MINOR.PATCH`) sur chaque version validée et testée.
- Les trois blocs fonctionnels demandés sont déjà présents dans l'état initial de ce dépôt ; les tags historiques ne doivent donc pas être créés sur des états de code fictifs.
