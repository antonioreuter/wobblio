Act as a Principal TypeScript Engineer. I want to implement a pure, Manual Dependency Injection (DI) architecture in this project without using any external IoC libraries, decorators, or 'reflect-metadata'. 

Please write/refactor the core services using a strict "Composition Root" pattern. Here is the specification you must follow:

### 1. The Container Contract (Types)
Create a `dependencies.ts` (or `types.ts`) file that explicitly defines the application's dependency graph using TypeScript interfaces or types.
- Define interfaces for all core services (e.g., ILogger, IDatabase, IUserService).
- Create a central `AppContext` (or `AppDependencies`) type that maps tokens/keys to these interfaces.

### 2. Dependency Injection Pattern
- Every class or service must accept its dependencies via an object in its constructor (Property/Dependency Object pattern). 
- Do not use positional constructor arguments; use a typed `deps` object to ensure scalability.
- Example pattern: 
  class UserService {
    constructor(private deps: Pick<AppContext, 'logger' | 'userRepo'>) {}
  }

### 3. The Composition Root
Create a `compositionRoot.ts` file. This file is the ONLY place where instantiation happens.
- It must export a `createContainer()` function that instantiates the concrete classes in the correct topological order (e.g., Logger -> Database -> Repository -> Service).
- It must return an object satisfying the `AppContext` type.

### 4. Entry Point
In the main application entry point (e.g., `index.ts` or `server.ts`), call `createContainer()`, extract the top-level services or controllers, and start the application.

Please generate a minimal, clean boilerplate implementing this for a mock scenario: a Logger, a UserRepository (hitting a mock DB), and a UserService. Keep the files modular and strictly typed.