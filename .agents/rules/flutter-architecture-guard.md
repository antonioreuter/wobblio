# Flutter Architecture Guard

Specialized guidelines for refactoring, BLoC state management pattern, Clean Code validation, and enforcing Hexagonal Architecture boundaries in the Flutter mobile application.

## Instructions
1. Ensure all business logic remains inside the core domain services or BLoC classes.
2. Device access, camera integrations, local key-value storage, and S3 file uploads MUST be defined as Ports (interfaces/abstract classes) and implemented in the adapters layer.
3. Domain files and BLoCs must never import from native or concrete adapter implementations.
4. Verify that client-side image manipulation (e.g. metadata stripping, exif removal, compression) is performed before triggering S3 upload.
5. Run the Flutter analyzer and execute widget tests before committing changes to ensure no regressions occur.
