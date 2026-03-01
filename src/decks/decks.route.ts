import { Request, Response, Router } from 'express'

import { authenticateToken } from '../auth/auth.middleware'
import { prisma } from '../database'

export const decksRouter = Router()

// POST /api/decks
// création d'un deck pour l'utilisateur connecté
decksRouter.post(
    '/',
    authenticateToken,
    async (req: Request, res: Response) => {
        const { name, cards } = req.body

        try {
            // récupération de l'id du client authentifier :
            const userId = req.userId

            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Utilisateur non authentifié' })
            }

            // vérification qu'il y a 10 cards :
            if (cards.length !== 10) {
                return res
                    .status(400)
                    .json({ error: 'Le deck doit contenir 10 cartes' })
            }

            // vérification que les carte existe :
            const cardsTrouver = await prisma.card.findMany({
                where: {
                    pokedexNumber: {
                        in: cards,
                    },
                },
            })

            if (cardsTrouver.length !== cards.length) {
                return res
                    .status(400)
                    .json({ error: "certaine carte n'existe pas" })
            }

            // vérification name
            if (!name) {
                return res
                    .status(400)
                    .json({ error: "il n'y a pas le nom du deck" })
            }

            // création du decks :
            const deck = await prisma.deck.create({
                data: {
                    name: name,
                    userId: userId,
                    cards: {
                        create: cards.map((cardId: number) => ({
                            cardId: cardId,
                        })),
                    },
                },
            })

            return res.status(201).json(deck)
        } catch (error) {
            console.error('Erreur lors de la connexion:', error)
            return res.status(500).json({ error: 'Erreur serveur' })
        }
    },
)

// GET /api/decks/mine
// Lister tous les decks de l'utilisateur authentifié avec leurs cartes.
decksRouter.get(
    '/mine',
    authenticateToken,
    async (req: Request, res: Response) => {
        try {
            // récupération de l'id du client authentifier :
            const userId = req.userId

            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Utilisateur non authentifié' })
            }

            // récupération des deck du client :
            const deckUser = await prisma.deck.findMany({
                where: {
                    userId: userId,
                },
                include: {
                    cards: true,
                },
            })

            return res.status(200).json(deckUser)
        } catch (error) {
            console.error('Erreur lors de la connexion:', error)
            return res.status(500).json({ error: 'Erreur serveur' })
        }
    },
)

// GET /api/decks/:id
// Consulter un deck spécifique avec ses cartes.
decksRouter.get(
    '/:deckId',
    authenticateToken,
    async (req: Request, res: Response) => {
        const deckId = parseInt(req.params.deckId)

        try {
            // récupération de l'id du client authentifier :
            const userId = req.userId

            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Utilisateur non authentifié' })
            }

            // vérification que le deck appartient a l'user identifier :
            const deck = await prisma.deck.findFirst({
                where: {
                    id: deckId,
                },
                include: {
                    cards: true,
                },
            })

            if (!deck) {
                return res.status(404).json({ error: "Le deck n'existe pas" })
            }

            if (deck.userId !== userId) {
                return res
                    .status(403)
                    .json({ error: "Le deck n'appartient pas a l'user" })
            }

            return res.status(200).json(deck)
        } catch (error) {
            console.error('Erreur lors de la connexion:', error)
            return res.status(500).json({ error: 'Erreur serveur' })
        }
    },
)

// PATCH /api/decks/:id
// Modifier le nom et/ou les cartes du deck.
decksRouter.patch(
    '/:deckId',
    authenticateToken,
    async (req: Request, res: Response) => {
        const deckId = parseInt(req.params.deckId)
        const { name, cards } = req.body

        try {
            // récupération de l'id du client authentifier :
            const userId = req.userId

            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Utilisateur non authentifié' })
            }

            // vérification que le deck appartient a l'user identifier :
            const deck = await prisma.deck.findFirst({
                where: {
                    id: deckId,
                },
                include: {
                    cards: true,
                },
            })

            if (!deck) {
                return res.status(404).json({ error: "Le deck n'existe pas" })
            }

            if (deck.userId !== userId) {
                return res
                    .status(403)
                    .json({ error: "Le deck n'appartient pas a l'user" })
            }

            // modification des information du deck :
            // vérification qu'il y a 10 cards :
            if (cards.length !== 10) {
                return res
                    .status(400)
                    .json({ error: 'Le deck doit contenir 10 cartes' })
            }

            // vérification que les carte existe :
            const cardsTrouver = await prisma.card.findMany({
                where: {
                    pokedexNumber: {
                        in: cards,
                    },
                },
            })

            if (cardsTrouver.length !== cards.length) {
                return res
                    .status(400)
                    .json({ error: "certaine carte n'existe pas" })
            }

            // vérification name
            if (!name) {
                return res
                    .status(400)
                    .json({ error: "il n'y a pas le nom du deck" })
            }

            // suppression de l'ancien deck :
            await prisma.deckCard.deleteMany({
                where: { deckId: deckId },
            })

            await prisma.deck.delete({
                where: { id: deckId },
            })

            // création du nouveau decks :
            const newDeck = await prisma.deck.create({
                data: {
                    name: name,
                    userId: userId,
                    cards: {
                        create: cards.map((cardId: number) => ({
                            cardId: cardId,
                        })),
                    },
                },
            })

            return res.status(200).json(newDeck)
        } catch (error) {
            console.error('Erreur lors de la connexion:', error)
            return res.status(500).json({ error: 'Erreur serveur' })
        }
    },
)

// DELETE /api/decks/:id
// Supprimer définitivement un deck
decksRouter.delete(
    '/:deckId',
    authenticateToken,
    async (req: Request, res: Response) => {
        const deckId = parseInt(req.params.deckId)

        try {
            // récupération de l'id du client authentifier :
            const userId = req.userId

            if (!userId) {
                return res
                    .status(401)
                    .json({ error: 'Utilisateur non authentifié' })
            }

            // vérification que le deck appartient a l'user identifier :
            const deck = await prisma.deck.findFirst({
                where: {
                    id: deckId,
                },
                include: {
                    cards: true,
                },
            })

            if (!deck) {
                return res.status(404).json({ error: "Le deck n'existe pas" })
            }

            if (deck.userId !== userId) {
                return res
                    .status(403)
                    .json({ error: "Le deck n'appartient pas a l'user" })
            }

            // suppression de l'ancien deck :
            await prisma.deckCard.deleteMany({
                where: { deckId: deckId },
            })

            await prisma.deck.delete({
                where: { id: deckId },
            })

            return res.status(200).json(deck)
        } catch (error) {
            console.error('Erreur lors de la connexion:', error)
            return res.status(500).json({ error: 'Erreur serveur' })
        }
    },
)
