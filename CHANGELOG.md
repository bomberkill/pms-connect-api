# API Changelog & Architectural Decisions

This document tracks significant changes to the `pms-connect-api` codebase, including the rationale behind them, to facilitate future debugging and maintenance.

## [Unreleased] - 2026-01-27

### Security
- **Strict CORS**: Removed wildcard `origin: "*"` in `main.ts`. Now using `CORS_ORIGINS` env var to whitelist domains.
- **Session Removal**: Removed `express-session` and `passport-session`. The API is now strictly stateless (JWT-only). This eliminates risks associated with server-side session management in a distributed environment.
- **Secret Sanitization**: Removed hardcoded fallback for session secrets. The app will now fail to start if critical env vars are missing (Secure by Default).

### Performance & Architecture
- **Posts Module**:
    - **Optimization**: Removed `.populate('author')` from `PostsService` methods (`create`, `findOne`, `findAllPosts`, `findPostsByAuthors`, `update`).
    - **Resolution**: Enabled `PostsResolver` to handle author fetching efficiently via `UserLoader` (Batching), preventing N+1 queries.
- **Groups Module**:
    - **Scalability**: Removed implicit `.populate('members.user')` and `.populate('creator')` in `GroupsService`. This prevents server crashes when accessing large groups.
    - **Resolution**: Added `@ResolveField('creator')` and `@ResolveField('members')` in `GroupsResolver` to load these relations on-demand via `UserLoader`.
- **Code Cleanup**:
    - **UsersResolver**: Commented out verbose console logs to reduce noise.
    - **AuthService**: Removed commented-out legacy code and fixed syntax errors.

### Logic & Architecture
- **Auth Guards**: Standardized usage in `UsersResolver`. `CombinedAuthGuard` for shared resources, `FirebaseAuthGuard` for user-specific actions, `AdminAuthGuard` for admin actions.
- **Race Conditions**: Fixed critical race condition in `GroupsService.addMember` by using atomic `findOneAndUpdate` with condition `{ 'members.user': { $ne: userId } }`.
- **Optimization**: Added `existsByEmail` in `UsersService` (lean query) and updated `AuthService` to use it instead of loading the full user document.

