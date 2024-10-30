# History

## v1.0.2

-   Refactor `getSockets` to return `this.userSockets` directly instead of using Redis.
-   Refactor `getSocket` to return `this.userSockets.get(userId)` directly instead of using Redis.

## v1.0.1

-   Clean `registerSocketForUser` method
    -   Add `extractUserId` method (private): Parses and validates `userId` from incoming data, throwing an error if `userId` is missing.
    -   Add `handleExistingConnection` method (private): Checks and disconnects existing sockets for a user, ensuring only one active connection.
    -   Add `saveUserSocketsToRedis` method (private): Manages Redis persistence of active user sockets, updating data after each connection change.
-   Add jsdoc comments to all methods
-   Add example in class documentation
-   Shortened public method names for simplicity:
    -   `initializeUserSockets` is now `initialize`
    -   `getUserSockets` is now `getSockets`
    -   `getUserSocket` is now `getSocket`
    -   `registerSocketForUser` is now `register`
    -   `deRegisterSocketForUser` is now `deregister`
    -   `informSocket` remains as `inform`
-   **Deprecated**: Original method names remain for backward compatibility but will be removed in future versions. Using these names now triggers a warning.
-   Add missing use of `initialize` method

## v1.0.0 - Initial Release

-   **Initial Features**:
    -   **Single Active Connection per User**: Maintains one active WebSocket connection per user, disconnecting prior connections.
    -   **Redis-Powered Persistence**: Stores and retrieves active user sockets via Redis, supporting distributed WebSocket applications.
    -   **User Socket Management**:
        -   Register and deregister sockets for users.
        -   Retrieve a user’s active socket.
    -   **Event Emission**: Emit events directly to a specified user socket.
    -   **Namespace Support**: Optionally set up namespaces for organized socket management.
