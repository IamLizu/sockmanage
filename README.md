# SocketMaster

SocketMaster is a utility library for managing WebSocket connections, ensuring each user has a single active socket connection at any given time. It uses Redis for persistence, making it suitable for scalable and distributed WebSocket applications.

## Features

-   Ensures one active socket per user.
-   Manages user sockets with Redis for persistence across multiple instances.
-   Provides methods to register, deregister, and retrieve user sockets.
-   Supports emitting events to specific users.

## Installation

To install with npm:

```
npm install socketmaster
```

or with Yarn:

```
yarn add socketmaster
```

## Usage

### Importing and Setting Up

```typescript
import { createClient } from "redis";
import { Server as SocketIOServer } from "socket.io";
import { SocketMaster } from "socketmaster";

// Initialize Redis and Socket.IO
const redisClient = createClient();
const io = new SocketIOServer(server); // assume 'server' is an HTTP server

// Initialize SocketMaster
const socketMaster = new SocketMaster({ redis: redisClient });

// Set up the Socket.IO server and specify the namespace (optional)
socketMaster.setup({ io, namespace: "/your-namespace" });
```

### Methods

#### `setup`

Sets up Socket.IO server and optional namespace.

```typescript
socketMaster.setup({ io, namespace: "/your-namespace" });
```

**Parameters:**

-   `io`: Instance of `SocketIOServer`.
-   `namespace` (optional): Namespace for Socket.IO events.

#### `initializeUserSockets`

Initializes user sockets from Redis.

```typescript
await socketMaster.initializeUserSockets();
```

#### `getUserSockets`

Retrieves all user sockets from Redis.

```typescript
const userSockets = await socketMaster.getUserSockets();
```

**Returns:** `Promise<Map<string, string> | null>`: A map of user IDs to socket IDs, or `null` if retrieval fails.

#### `getUserSocket`

Retrieves the socket ID for a specific user.

```typescript
const socketId = await socketMaster.getUserSocket("userId");
```

**Parameters:**

-   `userId`: ID of the user.

**Returns:** `Promise<string | null>`: Socket ID of the user or `null` if not found.

#### `registerSocketForUser`

Registers a socket for a user and ensures only one active socket per user.

```typescript
await socketMaster.registerSocketForUser(
    socket,
    JSON.stringify({ userId: "user1" })
);
```

**Parameters:**

-   `socket`: The socket instance.
-   `data`: A JSON string containing the `userId`.

#### `deRegisterSocketForUser`

Deregisters a socket for a user.

```typescript
socketMaster.deRegisterSocketForUser(socket);
```

**Parameters:**

-   `socket`: The socket instance to deregister.

#### `informSocket`

Emits an event to a specific socket.

```typescript
socketMaster.informSocket({
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
import { SocketMaster } from "socketmaster";

const redisClient = createClient();
const io = new SocketIOServer(server);

const socketMaster = new SocketMaster({ redis: redisClient });
socketMaster.setup({ io });

io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    socketMaster.registerSocketForUser(socket, JSON.stringify({ userId }));

    socket.on("disconnect", () => {
        socketMaster.deRegisterSocketForUser(socket);
    });

    // this following block is completely optional, you shall proceed with using your own event sending logic
    socket.on("message", (data) => {
        socketMaster.informSocket({
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

## License

MIT License. See [LICENSE](LICENSE) for details.
