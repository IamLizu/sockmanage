# History

## Unreleased

-   Clean `registerSocketForUser` method
    -   Add `extractUserId` method (private): Parses and validates `userId` from incoming data, throwing an error if `userId` is missing.
    -   Add `handleExistingConnection` method (private): Checks and disconnects existing sockets for a user, ensuring only one active connection.
    -   Add `saveUserSocketsToRedis` method (private): Manages Redis persistence of active user sockets, updating data after each connection change.

## v1.0.0 - Initial Release

-   **Initial Features**:
    -   **Single Active Connection per User**: Maintains one active WebSocket connection per user, disconnecting prior connections.
    -   **Redis-Powered Persistence**: Stores and retrieves active user sockets via Redis, supporting distributed WebSocket applications.
    -   **User Socket Management**:
        -   Register and deregister sockets for users.
        -   Retrieve a user’s active socket.
    -   **Event Emission**: Emit events directly to a specified user socket.
    -   **Namespace Support**: Optionally set up namespaces for organized socket management.