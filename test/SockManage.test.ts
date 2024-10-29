import { createClient } from 'redis';
import { Namespace, Socket, Server as SocketIOServer } from 'socket.io';
import { SockManage } from '../src/SockManage';

jest.mock('redis', () => ({
    createClient: jest.fn().mockReturnValue({
        get: jest.fn(),
        set: jest.fn(),
    }),
}));

jest.mock('socket.io', () => ({
    Server: jest.fn().mockReturnValue({
        of: jest.fn().mockReturnValue({
            sockets: new Map(),
            to: jest.fn().mockReturnValue({
                emit: jest.fn(),
            }),
        }),
    }),
}));

describe('SockManage', () => {
    let redisClient: any;
    let io: SocketIOServer;
    let namespace: Namespace;
    let socketManager: SockManage;
    let consoleErrorMock: jest.SpyInstance;

    beforeAll(() => {
        consoleErrorMock = jest
            .spyOn(console, 'error')
            .mockImplementation(() => {});
    });

    beforeEach(() => {
        redisClient = createClient();
        io = new SocketIOServer();
        namespace = io.of('/');
        socketManager = new SockManage({ redis: redisClient });
    });

    afterAll(() => {
        consoleErrorMock.mockRestore();
    });

    describe('setup', () => {
        it('should set up the io and namespace', () => {
            socketManager.setup({ io, namespace: '/test' });

            expect(socketManager['io']).toBe(io);
            expect(socketManager['namespace']).toBe(namespace);
        });
    });

    describe('initialize', () => {
        it('should initialize user sockets from Redis', async () => {
            const userSockets = JSON.stringify([['user1', 'socket1']]);

            redisClient.get.mockResolvedValue(userSockets);

            await socketManager.initialize();

            expect(socketManager['userSockets'].get('user1')).toBe('socket1');
        });
    });

    describe('getSockets', () => {
        it('should return user sockets from Redis', async () => {
            const userSockets = JSON.stringify([['user1', 'socket1']]);

            redisClient.get.mockResolvedValue(userSockets);

            const result = await socketManager.getSockets();

            expect(result?.get('user1')).toBe('socket1');
        });

        it('should return null if Redis data is invalid', async () => {
            redisClient.get.mockResolvedValue('invalid data');

            const result = await socketManager.getSockets();

            expect(result).toBeNull();
        });
    });

    describe('getSocket', () => {
        it('should return the socket ID for a given user', async () => {
            const userSockets = JSON.stringify([['user1', 'socket1']]);

            redisClient.get.mockResolvedValue(userSockets);

            const result = await socketManager.getSocket('user1');

            expect(result).toBe('socket1');
        });

        it('should return null if the user does not exist', async () => {
            redisClient.get.mockResolvedValue(null);

            const result = await socketManager.getSocket('user1');

            expect(result).toBeNull();
        });
    });

    describe('register', () => {
        it('should throw an error if userId is not found in data', async () => {
            const socket = {} as Socket;
            const data = JSON.stringify({});

            await expect(socketManager.register(socket, data)).rejects.toThrow(
                'userId not found in data, it is required!'
            );
        });

        it('should register a socket for a user', async () => {
            const socket = { id: 'socket1' } as Socket;
            const data = JSON.stringify({ userId: 'user1' });

            await socketManager.register(socket, data);

            expect(socketManager['userSockets'].get('user1')).toBe('socket1');
            expect(redisClient.set).toHaveBeenCalledWith(
                'userSockets',
                JSON.stringify([['user1', 'socket1']])
            );
        });

        it('should disconnect existing socket if a new one is registered', async () => {
            socketManager.setup({ io, namespace: '/test' });

            const existingSocket = {
                id: 'socket1',
                disconnect: jest.fn(),
            } as unknown as Socket;

            namespace.sockets.set('socket1', existingSocket);

            const socket = { id: 'socket2' } as Socket;
            const data = JSON.stringify({ userId: 'user1' });

            socketManager['userSockets'].set('user1', 'socket1');

            await socketManager.register(socket, data);

            expect(existingSocket.disconnect).toHaveBeenCalledWith(true);
            expect(socketManager['userSockets'].get('user1')).toBe('socket2');
        });
    });

    describe('deRegister', () => {
        it('should deregister a socket for a user', () => {
            const socket = {
                id: 'socket1',
                data: { userId: 'user1' },
            } as unknown as Socket;

            socketManager['userSockets'].set('user1', 'socket1');

            socketManager.deRegister(socket);

            expect(socketManager['userSockets'].has('user1')).toBe(false);
        });
    });

    describe('inform', () => {
        it('should inform a socket with an event and data', () => {
            const socketId = 'socket1';
            const _event = 'testEvent';
            const data = { message: 'test' };

            socketManager.setup({ io, namespace: '/test' });

            socketManager.inform({
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
