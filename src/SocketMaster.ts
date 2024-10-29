import { RedisClientType } from "redis";
import { Namespace, Socket, Server as SocketIOServer } from "socket.io";

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

export class SocketMaster {
    private userSockets: Map<string, string> = new Map();
    private redis: RedisClientType;
    private io!: SocketIOServer;
    private namespace!: Namespace;

    constructor({ redis }: SocketManagerOptions) {
        this.redis = redis;
    }

    setup({ io, namespace }: SetupOptions): void {
        this.io = io;
        this.namespace = namespace ? this.io.of(namespace) : this.io.of("/");
    }

    async initializeUserSockets(): Promise<void> {
        let userSockets = await this.redis.get("userSockets");

        if (userSockets) {
            this.userSockets = new Map(JSON.parse(userSockets));
        }
    }

    async getUserSockets(): Promise<Map<string, string> | null> {
        try {
            let userSockets = await this.redis.get("userSockets");

            if (userSockets) {
                try {
                    return new Map(JSON.parse(userSockets));
                } catch (error) {
                    console.error(
                        "Failed to parse userSockets from Redis:",
                        error
                    );

                    return null;
                }
            }

            return null;
        } catch (error) {
            console.error("Error retrieving userSockets from Redis:", error);

            return null;
        }
    }

    async getUserSocket(userId: string): Promise<string | null> {
        const userSockets = await this.getUserSockets();

        return userSockets ? userSockets.get(userId) || null : null;
    }

    async registerSocketForUser(socket: Socket, data: string): Promise<void> {
        const { userId } = JSON.parse(data);

        if (!userId || !socket.id) {
            console.warn("Invalid socket or user data:", {
                userId,
                socketId: socket.id,
            });
            return;
        }

        const existingSocketId = this.userSockets.get(userId);

        if (existingSocketId && existingSocketId !== socket.id) {
            const existingSocket = this.namespace.sockets.get(existingSocketId);

            existingSocket?.disconnect(true); // Disconnect existing socket if still connected
        }

        this.userSockets.set(userId, socket.id);

        try {
            await this.redis.set(
                "userSockets",
                JSON.stringify(Array.from(this.userSockets.entries()))
            );
        } catch (error) {
            console.error("Failed to persist user socket in Redis:", error);
        }
    }

    deRegisterSocketForUser(socket: Socket): void {
        const userId = socket.data?.userId;

        if (userId && this.userSockets.get(userId) === socket.id) {
            this.userSockets.delete(userId);
            // Note: No need to update Redis immediately; registerSocketForUser will handle it
        }
    }

    informSocket({
        namespace = "/",
        socketId,
        _event,
        data,
    }: InformSocketOptions): void {
        this.io.of(namespace).to(socketId).emit(_event, data);
    }
}
