import { createClient } from "redis";
import { Namespace, Socket, Server as SocketIOServer } from "socket.io";
import { SocketMaster } from "../src/SocketMaster";

jest.mock("redis", () => ({
    createClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
    }),
}));

jest.mock("socket.io", () => ({
    Server: jest.fn().mockReturnValue({
        of: jest.fn().mockReturnValue({
            sockets: new Map(),
            to: jest.fn().mockReturnValue({
                emit: jest.fn(),
            }),
        }),
    }),
}));

describe("SocketMaster", () => {
    let redisClient: any;
    let io: SocketIOServer;
    let namespace: Namespace;
    let socketMaster: SocketMaster;
    let consoleErrorMock: jest.SpyInstance;

    beforeAll(() => {
        consoleErrorMock = jest
            .spyOn(console, "error")
            .mockImplementation(() => {});
    });

    beforeEach(() => {
        redisClient = createClient();
        io = new SocketIOServer();
        namespace = io.of("/");
        socketMaster = new SocketMaster({ redis: redisClient });
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    describe("setup", () => {
        it("should set up the io and namespace", () => {
            socketMaster.setup({ io, namespace: "/test" });

            expect(socketMaster["io"]).toBe(io);
            expect(socketMaster["namespace"]).toBe(namespace);
        });
    });

    describe("initializeUserSockets", () => {
        it("should initialize user sockets from Redis", async () => {
            const userSockets = JSON.stringify([["user1", "socket1"]]);

            redisClient.get.mockResolvedValue(userSockets);

            await socketMaster.initializeUserSockets();

            expect(socketMaster["userSockets"].get("user1")).toBe("socket1");
        });
    });

    describe("getUserSockets", () => {
        it("should return user sockets from Redis", async () => {
            const userSockets = JSON.stringify([["user1", "socket1"]]);

            redisClient.get.mockResolvedValue(userSockets);

            const result = await socketMaster.getUserSockets();

            expect(result?.get("user1")).toBe("socket1");
        });

        it("should return null if Redis data is invalid", async () => {
            redisClient.get.mockResolvedValue("invalid data");

            const result = await socketMaster.getUserSockets();

            expect(result).toBeNull();
        });
    });

    describe("getUserSocket", () => {
        it("should return the socket ID for a given user", async () => {
            const userSockets = JSON.stringify([["user1", "socket1"]]);

            redisClient.get.mockResolvedValue(userSockets);

            const result = await socketMaster.getUserSocket("user1");

            expect(result).toBe("socket1");
        });

        it("should return null if the user does not exist", async () => {
            redisClient.get.mockResolvedValue(null);

            const result = await socketMaster.getUserSocket("user1");

            expect(result).toBeNull();
        });
    });

    describe("registerSocketForUser", () => {
        it("should register a socket for a user", async () => {
            const socket = { id: "socket1" } as Socket;
            const data = JSON.stringify({ userId: "user1" });

            await socketMaster.registerSocketForUser(socket, data);

            expect(socketMaster["userSockets"].get("user1")).toBe("socket1");
            expect(redisClient.set).toHaveBeenCalledWith(
                "userSockets",
                JSON.stringify([["user1", "socket1"]])
            );
        });

        it("should disconnect existing socket if a new one is registered", async () => {
            socketMaster.setup({ io, namespace: "/test" });

            const existingSocket = {
                id: "socket1",
                disconnect: jest.fn(),
            } as unknown as Socket;

            namespace.sockets.set("socket1", existingSocket);

            const socket = { id: "socket2" } as Socket;
            const data = JSON.stringify({ userId: "user1" });

            socketMaster["userSockets"].set("user1", "socket1");

            await socketMaster.registerSocketForUser(socket, data);

            expect(existingSocket.disconnect).toHaveBeenCalledWith(true);
            expect(socketMaster["userSockets"].get("user1")).toBe("socket2");
        });
    });

    describe("deRegisterSocketForUser", () => {
        it("should deregister a socket for a user", () => {
            const socket = {
                id: "socket1",
                data: { userId: "user1" },
            } as unknown as Socket;

            socketMaster["userSockets"].set("user1", "socket1");

            socketMaster.deRegisterSocketForUser(socket);

            expect(socketMaster["userSockets"].has("user1")).toBe(false);
        });
    });

    describe("informSocket", () => {
        it("should inform a socket with an event and data", () => {
            const socketId = "socket1";
            const _event = "testEvent";
            const data = { message: "test" };

            socketMaster.setup({ io, namespace: "/test" });

            socketMaster.informSocket({
                socketId,
                _event,
                data,
            });

            expect(namespace.to(socketId).emit).toHaveBeenCalledWith(
                _event,
                data
            );
        });
    });
});
