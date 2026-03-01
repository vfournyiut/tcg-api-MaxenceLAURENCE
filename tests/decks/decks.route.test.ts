import { describe, it, expect, vi, beforeEach } from 'vitest'
import request from 'supertest'
import express, { Request, Response, NextFunction } from 'express'
import { decksRouter } from '../../src/decks/decks.route'
import { prismaMock } from '../vitest.setup'
import { authenticateToken } from '../../src/auth/auth.middleware'
import jwt from 'jsonwebtoken'

vi.mock('../../src/auth/auth.middleware', () => ({
    authenticateToken: vi.fn(
        (req: Request, res: Response, next: NextFunction) => {
            const token = req.headers.authorization
            if (!token) {
                return res.status(401).json({ error: 'Token manquant' })
            }
            if (token === 'Bearer invalid-token') {
                return res
                    .status(401)
                    .json({ error: 'Token invalide ou expiré' })
            }
            // Simuler le décodage d'un token valide
            if (token.includes('Bearer')) {
                const decoded = jwt.decode(token.split(' ')[1]) as any
                req.userId = decoded?.userId || 1
                next()
            } else {
                next()
            }
        },
    ),
}))

describe('Decks Routes', () => {
    let app: express.Express

    beforeEach(() => {
        vi.clearAllMocks()
        process.env.JWT_SECRET = 'test-secret'

        app = express()
        app.use(express.json())
        app.use(express.json())
        // Suppression du middleware de définition manuelle de userId pour compter sur le mock authenticateToken
        app.use('/api/decks', decksRouter)
        app.use('/api/decks', decksRouter)
    })

    const validToken = jwt.sign(
        { userId: 1, email: 'test@example.com' },
        'test-secret',
    )
    const otherUserToken = jwt.sign(
        { userId: 2, email: 'other@example.com' },
        'test-secret',
    )

    describe('POST /api/decks', () => {
        const validDeck = {
            name: 'My Deck',
            cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        }

        it('doit créer un deck quand authentifié et les données sont valides', async () => {
            prismaMock.card.findMany.mockResolvedValue(
                new Array(10).fill({ id: 1 }),
            )

            const createdDeck = {
                id: 1,
                name: validDeck.name,
                userId: 1,
            }
            prismaMock.deck.create.mockResolvedValue(createdDeck as any)

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validDeck)

            expect(response.status).toBe(201)
            expect(response.body).toEqual(createdDeck)
            expect(prismaMock.deck.create).toHaveBeenCalled()
        })

        it('doit retourner 401 si le token est manquant', async () => {
            const response = await request(app)
                .post('/api/decks')
                .send(validDeck)

            // le middleware authenticateToken va échouer
            expect(response.status).toBe(401)
            expect(response.body.error).toBe('Token manquant')
        })

        it("doit retourner 400 si le nombre de cartes n'est pas 10", async () => {
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ ...validDeck, cards: [1, 2] })

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('Le deck doit contenir 10 cartes')
        })

        it("doit retourner 400 si certaines cartes n'existent pas", async () => {
            prismaMock.card.findMany.mockResolvedValue([]) // Aucune carte trouvée

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validDeck)

            expect(response.status).toBe(400)
            expect(response.body.error).toBe("certaine carte n'existe pas")
        })

        it('doit retourner 400 si le nom est manquant', async () => {
            // Mock les cartes existent
            prismaMock.card.findMany.mockResolvedValue(
                new Array(10).fill({ id: 1 }),
            )

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ ...validDeck, name: '' })

            expect(response.status).toBe(400)
            expect(response.body.error).toBe("il n'y a pas le nom du deck")
        })

        it("doit retourner 500 en cas d'erreur serveur", async () => {
            // Mock les cartes existent
            prismaMock.card.findMany.mockResolvedValue(
                new Array(10).fill({ id: 1 }),
            )
            prismaMock.deck.create.mockRejectedValue(new Error('DB Error'))

            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validDeck)

            expect(response.status).toBe(500)
            expect(response.body.error).toBe('Erreur serveur')
        })

        it('doit retourner 401 si userId manquant après auth (vérification défensive)', async () => {
            ;(authenticateToken as any).mockImplementationOnce(
                (req: Request, res: Response, next: NextFunction) => {
                    req.userId = undefined
                    next()
                },
            )
            const response = await request(app)
                .post('/api/decks')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validDeck)

            expect(response.status).toBe(401)
            expect(response.body.error).toBe('Utilisateur non authentifié')
        })
    })

    describe('GET /api/decks/mine', () => {
        it("doit retourner 200 et les decks de l'utilisateur", async () => {
            const mockDecks = [{ id: 1, name: 'Deck 1', userId: 1, cards: [] }]
            prismaMock.deck.findMany.mockResolvedValue(mockDecks as any)

            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual(mockDecks)
            expect(prismaMock.deck.findMany).toHaveBeenCalledWith({
                where: { userId: 1 },
                include: { cards: true },
            })
        })

        it('doit retourner 401 si non authentifié', async () => {
            const response = await request(app).get('/api/decks/mine')

            expect(response.status).toBe(401)
        })

        it("doit retourner 500 en cas d'erreur serveur", async () => {
            prismaMock.deck.findMany.mockRejectedValue(new Error('DB Error'))

            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(500)
        })
        it('doit retourner 401 si userId manquant après auth (vérification défensive)', async () => {
            ;(authenticateToken as any).mockImplementationOnce(
                (req: Request, res: Response, next: NextFunction) => {
                    req.userId = undefined
                    next()
                },
            )
            const response = await request(app)
                .get('/api/decks/mine')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(401)
            expect(response.body.error).toBe('Utilisateur non authentifié')
        })
    })

    describe('GET /api/decks/:deckId', () => {
        it("doit retourner 200 et le deck s'il appartient à l'utilisateur", async () => {
            const mockDeck = { id: 1, name: 'Deck 1', userId: 1, cards: [] }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)

            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual(mockDeck)
        })

        it("doit retourner 404 si le deck n'existe pas", async () => {
            prismaMock.deck.findFirst.mockResolvedValue(null)

            const response = await request(app)
                .get('/api/decks/999')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(404)
            expect(response.body.error).toBe("Le deck n'existe pas")
        })

        it('doit retourner 403 si le deck appartient à un autre utilisateur', async () => {
            const mockDeck = { id: 1, name: 'Deck 1', userId: 2, cards: [] }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)

            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(403)
            expect(response.body.error).toBe(
                "Le deck n'appartient pas a l'user",
            )
        })

        it("doit retourner 500 en cas d'erreur serveur", async () => {
            prismaMock.deck.findFirst.mockRejectedValue(new Error('DB Error'))

            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(500)
        })
        it('doit retourner 401 si userId manquant après auth (vérification défensive)', async () => {
            ;(authenticateToken as any).mockImplementationOnce(
                (req: Request, res: Response, next: NextFunction) => {
                    req.userId = undefined
                    next()
                },
            )
            const response = await request(app)
                .get('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(401)
            expect(response.body.error).toBe('Utilisateur non authentifié')
        })
    })

    describe('PATCH /api/decks/:deckId', () => {
        const validUpdate = {
            name: 'Updated Deck',
            cards: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
        }

        it("doit mettre à jour le deck quand les données sont valides et l'utilisateur possède le deck", async () => {
            const mockDeck = { id: 1, name: 'Old Name', userId: 1 }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)
            prismaMock.card.findMany.mockResolvedValue(
                new Array(10).fill({ id: 1 }),
            )

            const updatedDeck = { id: 1, ...validUpdate, userId: 1 }
            prismaMock.deck.create.mockResolvedValue(updatedDeck as any) // La route utilise create après delete

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validUpdate)

            expect(response.status).toBe(200)
            expect(response.body).toEqual(updatedDeck)
            // Vérifier les appels de suppression
            expect(prismaMock.deckCard.deleteMany).toHaveBeenCalledWith({
                where: { deckId: 1 },
            })
            expect(prismaMock.deck.delete).toHaveBeenCalledWith({
                where: { id: 1 },
            })
            // Vérifier l'appel de création
            expect(prismaMock.deck.create).toHaveBeenCalled()
        })

        it("doit retourner 404 si le deck n'existe pas", async () => {
            prismaMock.deck.findFirst.mockResolvedValue(null)

            const response = await request(app)
                .patch('/api/decks/999')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validUpdate)

            expect(response.status).toBe(404)
        })

        it("doit retourner 403 si l'utilisateur n'est pas le propriétaire", async () => {
            const mockDeck = { id: 1, name: 'Old Name', userId: 2 }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validUpdate)

            expect(response.status).toBe(403)
        })

        it('doit retourner 400 si le nombre de cartes est invalide', async () => {
            const mockDeck = { id: 1, name: 'Old Name', userId: 1 }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ ...validUpdate, cards: [1] })

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('Le deck doit contenir 10 cartes')
        })

        it("doit retourner 400 si certaines cartes n'existent pas", async () => {
            const mockDeck = { id: 1, name: 'Old Name', userId: 1 }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)
            prismaMock.card.findMany.mockResolvedValue([]) // Aucune carte trouvée

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validUpdate)

            expect(response.status).toBe(400)
            expect(response.body.error).toBe("certaine carte n'existe pas")
        })

        it('doit retourner 400 si le nom est manquant', async () => {
            const mockDeck = { id: 1, name: 'Old Name', userId: 1 }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)
            prismaMock.card.findMany.mockResolvedValue(
                new Array(10).fill({ id: 1 }),
            )

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send({ ...validUpdate, name: '' })

            expect(response.status).toBe(400)
            expect(response.body.error).toBe("il n'y a pas le nom du deck")
        })

        it("doit retourner 500 en cas d'erreur serveur", async () => {
            prismaMock.deck.findFirst.mockRejectedValue(new Error('DB Error'))

            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validUpdate)

            expect(response.status).toBe(500)
        })
        it('doit retourner 401 si userId manquant après auth (vérification défensive)', async () => {
            ;(authenticateToken as any).mockImplementationOnce(
                (req: Request, res: Response, next: NextFunction) => {
                    req.userId = undefined
                    next()
                },
            )
            const response = await request(app)
                .patch('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)
                .send(validUpdate)

            expect(response.status).toBe(401)
            expect(response.body.error).toBe('Utilisateur non authentifié')
        })
    })

    describe('DELETE /api/decks/:deckId', () => {
        it("doit supprimer le deck si l'utilisateur le possède", async () => {
            const mockDeck = { id: 1, name: 'To Delete', userId: 1, cards: [] }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)

            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(200)
            expect(response.body).toEqual(mockDeck)
            expect(prismaMock.deckCard.deleteMany).toHaveBeenCalledWith({
                where: { deckId: 1 },
            })
            expect(prismaMock.deck.delete).toHaveBeenCalledWith({
                where: { id: 1 },
            })
        })

        it("doit retourner 404 si le deck n'existe pas", async () => {
            prismaMock.deck.findFirst.mockResolvedValue(null)

            const response = await request(app)
                .delete('/api/decks/999')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(404)
        })

        it("doit retourner 403 si l'utilisateur n'est pas le propriétaire", async () => {
            const mockDeck = { id: 1, name: 'To Delete', userId: 2, cards: [] }
            prismaMock.deck.findFirst.mockResolvedValue(mockDeck as any)

            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(403)
        })

        it("doit retourner 500 en cas d'erreur serveur", async () => {
            prismaMock.deck.findFirst.mockRejectedValue(new Error('DB Error'))

            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(500)
        })
        it('doit retourner 401 si userId manquant après auth (vérification défensive)', async () => {
            ;(authenticateToken as any).mockImplementationOnce(
                (req: Request, res: Response, next: NextFunction) => {
                    req.userId = undefined
                    next()
                },
            )
            const response = await request(app)
                .delete('/api/decks/1')
                .set('Authorization', `Bearer ${validToken}`)

            expect(response.status).toBe(401)
            expect(response.body.error).toBe('Utilisateur non authentifié')
        })
    })
})
