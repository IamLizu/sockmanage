import { RedisClientType } from 'redis';
import { Namespace, Socket, Server as SocketIOServer } from 'socket.io';
import { deprecate } from 'util';

interface SocketManagerOptions {
    redis: RedisClientType;
}

interface SetupOptions {
    io: SocketIOServer;
    namespace?: string;
}

interface InformSocketOptions {
    namespace?: string;
    socketId: string;
    _event: string;
    data: any;
}

/**
 * The `SockManage` class is responsible for managing user socket connections
 * using Socket.IO and Redis. It provides methods to set up the Socket.IO server,
 * initialize user sockets from Redis, register and deregister user sockets, and
 * send events to specific sockets.
 *
 *
 * @example
 * import { createClient } from "redis";
 * import { Server as SocketIOServer } from "socket.io";
 * import { SockManage } from "sockmanage";
 *
 * const redisClient = createClient();
 * const io = new SocketIOServer(server);
 *
 * const socketManager = new SockManage({ redis: redisClient });
 * socketManager.setup({ io, namespace: "/chat" });
 *
 * io.on("connection", (socket) => {
 *     // You be getting the userId from anywhere, it doesn't matter where you get it from
 *     // as long as you pass it to the register method.
 *     const userId = socket.handshake.query.userId;
 *
 *     socketManager.register(socket, JSON.stringify({ userId }));
 *
 *     socket.on("disconnect", () => {
 *         socketManager.deRegister(socket);
 *     });
 *
 *     // this following block is completely optional, you shall proceed with using your own event sending logic
 *     socket.on("message", (data) => {
 *         socketManager.inform({
 *             socketId: socket.id,
 *             _event: "message",
 *             data: { message: "Hello, User!" },
 *         });
 *     });
 * });
 *
 */
export class SockManage {
    private userSockets: Map<string, string> = new Map();
    private redis: RedisClientType;
    private io!: SocketIOServer;
    private namespace!: Namespace;

    /**
     * Creates an instance of SocketManager.
     *
     * @param {SocketManagerOptions} options - The options for the SocketManager.
     * @param {RedisClient} options.redis - The Redis client instance to be used by the SocketManager.
     */
    constructor({ redis }: SocketManagerOptions) {
        this.redis = redis;
    }

    /**
     * Sets up the socket.io instance with the provided options.
     *
     * @param {SetupOptions} options - The setup options.
     * @param {SocketIO.Server} options.io - The socket.io server instance.
     * @param {string} [options.namespace] - The namespace to use. Defaults to the root namespace if not provided.
     * @returns {void}
     */
    setup({ io, namespace }: SetupOptions): void {
        this.io = io;
        this.namespace = namespace ? this.io.of(namespace) : this.io.of('/');
    }

    /**
     * Initializes the user sockets by retrieving the data from Redis.
     * If the data exists, it parses the JSON string and sets the userSockets property.
     *
     * @returns {Promise<void>} A promise that resolves when the user sockets have been initialized.
     */
    async initialize(): Promise<void> {
        let userSockets = await this.redis.get('userSockets');

        if (userSockets) {
            this.userSockets = new Map(JSON.parse(userSockets));
        }
    }

    /**
     * @deprecated Use `initialize` instead.
     */
    initializeUserSockets = deprecate(
        this.initialize,
        'initializeUserSockets() is deprecated. Use initialize() instead.'
    );

    /**
     * Retrieves the user sockets from Redis.
     *
     * @returns {Promise<Map<string, string> | null>} A promise that resolves to a Map of user sockets if available, or null if not found or an error occurs.
     *
     * @throws Will log an error message if there is an issue retrieving or parsing the user sockets from Redis.
     */
    async getSockets(): Promise<Map<string, string> | null> {
        try {
            let userSockets = await this.redis.get('userSockets');

            if (userSockets) {
                try {
                    return new Map(JSON.parse(userSockets));
                } catch (error) {
                    console.error(
                        'Failed to parse userSockets from Redis:',
                        error
                    );

                    return null;
                }
            }

            return null;
        } catch (error) {
            console.error('Error retrieving userSockets from Redis:', error);

            return null;
        }
    }

    /**
     * @deprecated Use `getSockets` instead.
     */
    getUserSockets = deprecate(
        this.getSockets,
        'getUserSockets() is deprecated. Use getSockets() instead.'
    );

    /**
     * Retrieves the socket ID associated with a given user ID.
     *
     * @param userId - The unique identifier of the user.
     * @returns A promise that resolves to the socket ID as a string if found, or null if not found.
     */
    async getSocket(userId: string): Promise<string | null> {
        const userSockets = await this.getSockets();

        return userSockets ? userSockets.get(userId) || null : null;
    }

    /**
     * @deprecated Use `getSocket` instead.
     */
    getUserSocket = deprecate(
        this.getSocket,
        'getUserSocket() is deprecated. Use getSocket() instead.'
    );

    /**
     * Registers a socket connection for a user.
     *
     * @param socket - The socket instance to be registered.
     * @param data - The data containing user information.
     * @returns A promise that resolves when the socket is registered.
     * @throws Will throw an error if the userId is not found in the data.
     */
    async register(socket: Socket, data: string): Promise<void> {
        const userId = this.extractUserId(data);

        if (!userId) {
            throw new Error('userId not found in data, it is required!');
        }

        await this.handleExistingConnection(userId, socket);

        this.userSockets.set(userId, socket.id);
        await this.saveUserSocketsToRedis();
    }

    /**
     * @deprecated Use `register` instead.
     */
    registerSocketForUser = deprecate(
        this.register,
        'registerSocketForUser() is deprecated. Use register() instead.'
    );

    /**
     * Extracts the user ID from a JSON string.
     *
     * @param data - A JSON string containing user data.
     * @returns The user ID if present, otherwise `null`.
     * @throws Will log an error and return `null` if the JSON parsing fails.
     */
    private extractUserId(data: string): string | null {
        try {
            const parsedData = JSON.parse(data);

            return parsedData.userId || null;
        } catch (error) {
            console.error('Failed to parse user data:', error);
            return null;
        }
    }

    /**
     * Handles an existing connection for a user by disconnecting any previous socket connection
     * associated with the user if it exists and is different from the new socket.
     *
     * @param userId - The unique identifier of the user.
     * @param newSocket - The new socket connection for the user.
     * @returns A promise that resolves when the existing connection, if any, has been handled.
     */
    private async handleExistingConnection(
        userId: string,
        newSocket: Socket
    ): Promise<void> {
        const existingSocketId = this.userSockets.get(userId);

        if (existingSocketId && existingSocketId !== newSocket.id) {
            const existingSocket = this.namespace.sockets.get(existingSocketId);

            existingSocket?.disconnect(true);
        }
    }

    /**
     * Saves the current user sockets to Redis.
     *
     * This method serializes the `userSockets` map and stores it in Redis under the key 'userSockets'.
     * If an error occurs during the process, it logs the error to the console.
     *
     * @returns {Promise<void>} A promise that resolves when the operation is complete.
     * @throws Will log an error message if the operation fails.
     */
    private async saveUserSocketsToRedis(): Promise<void> {
        try {
            await this.redis.set(
                'userSockets',
                JSON.stringify(Array.from(this.userSockets.entries()))
            );
        } catch (error) {
            console.error('Failed to persist user sockets in Redis:', error);
        }
    }

    /**
     * Deregisters a socket for a user.
     *
     * This method removes the socket associated with a user from the userSockets map
     * if the socket's userId matches the stored socket id. It does not immediately update
     * Redis, as the `register` method will handle the update.
     *
     * @param socket - The socket to be deregistered.
     */
    deRegister(socket: Socket): void {
        const userId = socket.data?.userId;

        if (userId && this.userSockets.get(userId) === socket.id) {
            this.userSockets.delete(userId);
            // Note: No need to update Redis immediately; register will handle it
        }
    }

    /**
     * @deprecated Use `deRegister` instead.
     */
    deRegisterSocketForUser = deprecate(
        this.deRegister,
        'deRegisterSocketForUser() is deprecated. Use deRegister() instead.'
    );

    /**
     * Sends an event to a specific socket within a namespace.
     *
     * @param {InformSocketOptions} options - The options for informing the socket.
     * @param {string} [options.namespace='/'] - The namespace of the socket. Defaults to '/'.
     * @param {string} options.socketId - The ID of the socket to send the event to.
     * @param {string} options._event - The event name to emit.
     * @param {any} options.data - The data to send with the event.
     * @returns {void}
     */
    inform({
        namespace = '/',
        socketId,
        _event,
        data,
    }: InformSocketOptions): void {
        this.io.of(namespace).to(socketId).emit(_event, data);
    }

    /**
     * @deprecated Use `inform` instead.
     */
    informSocket = deprecate(
        this.inform,
        'informSocket() is deprecated. Use inform() instead.'
    );
}
