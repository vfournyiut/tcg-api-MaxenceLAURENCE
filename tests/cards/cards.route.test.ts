import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { cardsRouter } from '../../src/cards/cards.route';
import { prismaMock } from '../vitest.setup';
import jwt from 'jsonwebtoken';

describe('Cards Routes', () => {
    let app: express.Express;

    beforeEach(() => {
        vi.clearAllMocks();
        process.env.JWT_SECRET = 'test-secret';

        app = express();
        app.use(express.json());
        app.use('/api/cards', cardsRouter);
    });

    const validToken = jwt.sign({ userId: 1, email: 'test@example.com' }, 'test-secret');

    describe('GET /api/cards', () => {
        it('doit retourner 200 et une liste de cartes quand authentifié', async () => {
            const mockCards = [
                { id: 1, name: 'Pikachu', pokedexNumber: 25 },
                { id: 2, name: 'Charizard', pokedexNumber: 6 },
            ];

            prismaMock.card.findMany.mockResolvedValue(mockCards as any);

            const response = await request(app)
                .get('/api/cards')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(200);
            expect(response.body).toEqual({ cardsList: mockCards });
            expect(prismaMock.card.findMany).toHaveBeenCalledWith({
                orderBy: {
                    pokedexNumber: 'asc'
                }
            });
        });

        it('doit retourner 401 si le token est absent', async () => {
            const response = await request(app)
                .get('/api/cards');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token manquant');
        });

        it('doit retourner 401 si le token est invalide', async () => {
            const response = await request(app)
                .get('/api/cards')
                .set('Authorization', 'Bearer invalid-token');

            expect(response.status).toBe(401);
            expect(response.body.error).toBe('Token invalide ou expiré');
        });

        it('doit retourner 500 en cas d\'erreur serveur', async () => {
            prismaMock.card.findMany.mockRejectedValue(new Error('DB Error'));

            const response = await request(app)
                .get('/api/cards')
                .set('Authorization', `Bearer ${validToken}`);

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Erreur serveur');
        });
    });
});
