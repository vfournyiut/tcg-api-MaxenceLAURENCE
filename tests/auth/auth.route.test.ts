import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { authRouter } from '../../src/auth/auth.route';
import { prismaMock } from '../vitest.setup';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';


describe('Auth Routes', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';
    });

    const app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    describe('GET /api/auth/test-auth', () => {
        it('doit retourner 200 et les infos utilisateur si le token est valide', async () => {
            const token = jwt.sign({ userId: 1, email: 'test@example.com' }, 'test-secret');

            const response = await request(app)
                .get('/api/auth/test-auth')
                .set('Authorization', `Bearer ${token}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({
                message: 'Authenticated',
                userId: 1,
                email: 'test@example.com'
            });
        });

        it('doit retourner 401 si le token est absent', async () => {
            const response = await request(app)
                .get('/api/auth/test-auth');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token manquant');
        });
    });

    describe('POST /api/auth/sign-up', () => {
        const validUser = {
            email: 'test@example.com',
            username: 'testuser',
            password: 'password123',
        };

        it('doit créer un nouvel utilisateur et retourner un token', async () => {
            // unique email : mock null
            prismaMock.user.findUnique.mockResolvedValueOnce(null);
            // unique username : mock null
            prismaMock.user.findUnique.mockResolvedValueOnce(null);

            // Mock create user
            const createdUser = {
                id: 1,
                email: validUser.email,
                username: validUser.username,
                password: 'hashedpassword',
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            prismaMock.user.create.mockResolvedValue(createdUser as any);

            const response = await request(app)
                .post('/api/auth/sign-up')
                .send(validUser);

            expect(response.status).toBe(201);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toEqual({
                id: 1,
                name: validUser.username,
                email: validUser.email,
            });
            expect(prismaMock.user.create).toHaveBeenCalled();
        });

        it('doit retourner 400 si l\'email est absent', async () => {
            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({ ...validUser, email: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Email manquant');
        });

        it('doit retourner 400 si le mot de passe est absent', async () => {
            // unique email : mock null
            prismaMock.user.findUnique.mockResolvedValueOnce(null);

            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({ ...validUser, password: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Password manquant');
        });

        it('doit retourner 400 si le nom d\'utilisateur est absent', async () => {
            // unique email : mock null
            prismaMock.user.findUnique.mockResolvedValueOnce(null);
            // unique username : mock null
            prismaMock.user.findUnique.mockResolvedValueOnce(null);

            const response = await request(app)
                .post('/api/auth/sign-up')
                .send({ ...validUser, username: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Username manquant');
        });

        it('doit retourner 409 si l\'email est déja utiliser', async () => {
            prismaMock.user.findUnique.mockResolvedValue({ id: 1 } as any);

            const response = await request(app)
                .post('/api/auth/sign-up')
                .send(validUser);

            expect(response.status).toBe(409);
            expect(response.body.error).toBe("L'email déja utiliser");
        });

        it('doit retourner 409 si le nom d\'utilisateur est déja utiliser', async () => {
            // unique email : mock null
            prismaMock.user.findUnique.mockResolvedValueOnce(null);
            // unique username : mock user
            prismaMock.user.findUnique.mockResolvedValueOnce({ id: 1 } as any);

            const response = await request(app)
                .post('/api/auth/sign-up')
                .send(validUser);

            expect(response.status).toBe(409);
            expect(response.body.error).toBe("L'username déja utiliser");
        });

        it('doit retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.user.findUnique.mockRejectedValue(new Error('DB Error'));

            const response = await request(app)
                .post('/api/auth/sign-up')
                .send(validUser);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Erreur serveur');
        });
    });

    describe('POST /api/auth/sign-in', () => {
        const loginData = {
            email: 'test@example.com',
            password: 'password123',
        };

        it('doit authentifier l\'utilisateur et retourner un token', async () => {
            const mockUser = {
                id: 1,
                email: loginData.email,
                username: 'testuser',
                password: await bcrypt.hash(loginData.password, 10), // We use real bcrypt here for validation? Or we can mock confirm
            };

            prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

            // We need to verify that the controller uses bcrypt.compare
            // Since we are running in the same process, we can rely on real bcrypt if we hashed it correctly above.

            const response = await request(app)
                .post('/api/auth/sign-in')
                .send(loginData);

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('token');
            expect(response.body.user).toEqual({
                id: 1,
                name: 'testuser',
                email: loginData.email,
            });
        });

        it('doit retourner 400 si l\'email est absent', async () => {
            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({ ...loginData, email: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Email manquant');
        });

        it('doit retourner 400 si le mot de passe est absent', async () => {
            // User found
            prismaMock.user.findUnique.mockResolvedValue({ id: 1 } as any);

            const response = await request(app)
                .post('/api/auth/sign-in')
                .send({ ...loginData, password: '' });

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Password manquant');
        });

        it('doit retourner 401 si l\'utilisateur n\'est pas trouvé', async () => {
            prismaMock.user.findUnique.mockResolvedValue(null);

            const response = await request(app)
                .post('/api/auth/sign-in')
                .send(loginData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Email ou mot de passe incorrect');
        });

        it('doit retourner 401 si le mot de passe est incorrect', async () => {
            const mockUser = {
                id: 1,
                email: loginData.email,
                username: 'testuser',
                password: await bcrypt.hash('wrongpassword', 10),
            };
            prismaMock.user.findUnique.mockResolvedValue(mockUser as any);

            const response = await request(app)
                .post('/api/auth/sign-in')
                .send(loginData);

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Email ou mot de passe incorrect');
        });

        it('doit retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.user.findUnique.mockRejectedValue(new Error('DB Error'));

            const response = await request(app)
                .post('/api/auth/sign-in')
                .send(loginData);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Erreur serveur');
        });
    });
});
