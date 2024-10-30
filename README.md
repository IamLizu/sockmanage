# SockManage

SockManage is a utility library for managing WebSocket connections, ensuring each user has a single active socket connection at any given time. It uses Redis for persistence, making it suitable for scalable and distributed WebSocket applications.

## Features

-   Ensures one active socket per user.
-   Manages user sockets with Redis for persistence across multiple instances.
-   Provides methods to register, deregister, and retrieve user sockets.
-   Supports emitting events to specific users.

## Installation

To install with npm:

```
npm install sockmanage
```

or with Yarn:

```
yarn add sockmanage
```

## Usage

### Importing and Setting Up

```typescript
import { createClient } from "redis";
import { Server as SocketIOServer } from "socket.io";
import { SockManage } from "sockmanage";

// Initialize Redis and Socket.IO
const redisClient = createClient();
const io = new SocketIOServer(server); // assume 'server' is an HTTP server

// Initialize SockManage
const socketManager = new SockManage({ redis: redisClient });

// Set up the Socket.IO server and specify the namespace (optional)
socketManager.setup({ io, namespace: "/your-namespace" });

// Assuming top-level await is supported, otherwise wrap the following line in an async function
await socketManager.initialize();
```

### Methods

#### `setup`

Sets up Socket.IO server and optional namespace.

```typescript
socketManager.setup({ io, namespace: "/your-namespace" });
```

**Parameters:**

-   `io`: Instance of `SocketIOServer`.
-   `namespace` (optional): Namespace for Socket.IO events.

#### `initialize`

Initializes user sockets from Redis.

```typescript
await socketManager.initialize();
```

#### `getSockets`

Retrieves all user sockets from local map.

```typescript
const userSockets = socketManager.getSockets();
```

**Returns:** `Map<string, string>`: A map of user IDs to socket IDs, or an empty map.

#### `getSocket`

Retrieves the socket ID for a specific user.

```typescript
const socketId = socketManager.getSocket("userId");
```

**Parameters:**

-   `userId`: ID of the user.

**Returns:** `string | null`: Socket ID of the user or `null` if not found.

#### `register`

Registers a socket for a user and ensures only one active socket per user.  
**Note:** The `data` parameter must be a JSON string containing the `userId`.

```typescript
await socketManager.register(socket, JSON.stringify({ userId: "user1" }));
```

**Parameters:**

-   `socket`: The socket instance.
-   `data`: A JSON string containing the `userId`.

#### `deRegister`

De-registers a socket for a user.

```typescript
socketManager.deRegister(socket);
```

**Parameters:**

-   `socket`: The socket instance to deregister.

#### `inform`

Emits an event to a specific socket.

```typescript
socketManager.inform({
    socketId: "socket1",
    _event: "message",
    data: { message: "Hello, User!" },
});
```

**Parameters:**

-   `socketId`: ID of the socket to emit the event to.
-   `_event`: Event name.
-   `data`: Data to send with the event.

## Example

```typescript
import { createClient } from "redis";
import { Server as SocketIOServer } from "socket.io";
import { SockManage } from "sockmanage";

const redisClient = createClient();
const io = new SocketIOServer(server);

const socketManager = new SockManage({ redis: redisClient });
socketManager.setup({ io });

// Assuming top-level await is supported, otherwise wrap the following line in an async function
await socketManager.initialize();

io.on("connection", (socket) => {
    // You be getting the userId from anywhere, it doesn't matter where you get it from
    // as long as you pass it to the register method.
    const userId = socket.handshake.query.userId;

    socketManager.register(socket, JSON.stringify({ userId }));

    socket.on("disconnect", () => {
        socketManager.deRegister(socket);
    });

    // this following block is completely optional, you shall proceed with using your own event sending logic
    socket.on("message", (data) => {
        socketManager.inform({
            socketId: socket.id,
            _event: "message",
            data: { message: "Hello, User!" },
        });
    });
});
```

## Testing

To run the tests, use the following command:

```bash
yarn test
```

## Changelog

Detailed changes for each version are documented in the [History.md](History.md) file.

## License

MIT License. See [LICENSE](LICENSE) for details.
