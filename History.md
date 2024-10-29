# History

## v1.0.0 - Initial Release
- **Initial Features**:
  - **Single Active Connection per User**: Maintains one active WebSocket connection per user, disconnecting prior connections.
  - **Redis-Powered Persistence**: Stores and retrieves active user sockets via Redis, supporting distributed WebSocket applications.
  - **User Socket Management**: 
    - Register and deregister sockets for users.
    - Retrieve a user’s active socket.
  - **Event Emission**: Emit events directly to a specified user socket.
  - **Namespace Support**: Optionally set up namespaces for organized socket management.