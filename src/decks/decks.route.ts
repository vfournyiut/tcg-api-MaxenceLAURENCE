import { Request, Response, Router } from 'express'
import { authenticateToken } from '../auth/auth.middleware'
import { prisma } from "../database";

export const decksRouter = Router()


/**
 * Route POST /api/decks
 * 
 * Crée un nouveau deck pour l'utilisateur connecté.
 * Vérifie que le deck contient exactement 10 cartes valides et possède un nom.
 * 
 * @param {Request} req - L'objet Request d'Express.
 *  - body.name: Le nom du deck.
 *  - body.cards: Un tableau d'IDs de cartes (number[]).
 *  - userId: Ajouté par le middleware d'authentification.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 201: Deck créé avec succès.
 *  - 400: Données invalides (nom manquant, nombre de cartes incorrect, cartes inexistantes).
 *  - 401: Utilisateur non authentifié.
 *  - 500: Erreur serveur interne.
 */
decksRouter.post('/', authenticateToken, async (req: Request, res: Response) => {
    const { name, cards } = req.body

    try {
        // récupération de l'id du client authentifier : 
        const userId = req.userId

        if (!userId) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' })
        }

        // vérification qu'il y a 10 cards : 
        if (cards.length !== 10) {
            return res.status(400).json({ error: 'Le deck doit contenir 10 cartes' })
        }

        // vérification que les carte existe : 
        const cardsTrouver = await prisma.card.findMany({
            where: {
                pokedexNumber: {
                    in: cards
                }
            }
        })

        if (cardsTrouver.length !== cards.length) {
            return res.status(400).json({ error: 'certaine carte n\'existe pas' })
        }

        // vérification name 
        if (!name) {
            return res.status(400).json({ error: 'il n\'y a pas le nom du deck' })
        }


        // création du decks : 
        const deck = await prisma.deck.create({
            data: {
                name: name,
                userId: userId,
                cards: {
                    create: cards.map((cardId: number) => ({
                        cardId: cardId
                    }))
                }
            },
        });

        return res.status(201).json(deck);
    }
    catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})



/**
 * Route GET /api/decks/mine
 * 
 * Récupère la liste de tous les decks appartenant à l'utilisateur connecté.
 * Inclut les cartes associées à chaque deck.
 * 
 * @param {Request} req - L'objet Request d'Express.
 *  - userId: Ajouté par le middleware d'authentification.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 200: Succès, retourne la liste des decks.
 *  - 401: Utilisateur non authentifié.
 *  - 500: Erreur serveur interne.
 */
decksRouter.get('/mine', authenticateToken, async (req: Request, res: Response) => {
    try {
        // récupération de l'id du client authentifier : 
        const userId = req.userId

        if (!userId) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' })
        }

        // récupération des deck du client : 
        const deckUser = await prisma.deck.findMany({
            where: {
                userId: userId,
            },
            include: {
                cards: true
            }
        })

        return res.status(200).json(deckUser)
    }
    catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})



/**
 * Route GET /api/decks/:id
 * 
 * Récupère les détails d'un deck spécifique par son ID.
 * Vérifie que le deck existe et appartient à l'utilisateur connecté.
 * 
 * @param {Request} req - L'objet Request d'Express.
 *  - params.deckId: L'ID du deck à récupérer.
 *  - userId: Ajouté par le middleware d'authentification.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 200: Succès, retourne le deck avec ses cartes.
 *  - 401: Utilisateur non authentifié.
 *  - 403: Le deck n'appartient pas à l'utilisateur.
 *  - 404: Le deck n'existe pas.
 *  - 500: Erreur serveur interne.
 */
decksRouter.get('/:deckId', authenticateToken, async (req: Request, res: Response) => {
    const deckId = parseInt(req.params.deckId);

    try {
        // récupération de l'id du client authentifier : 
        const userId = req.userId

        if (!userId) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' })
        }

        // vérification que le deck appartient a l'user identifier : 
        const deck = await prisma.deck.findFirst({
            where: {
                id: deckId,
            },
            include: {
                cards: true
            }
        })

        if (!deck) {
            return res.status(404).json({ error: 'Le deck n\'existe pas' })
        }

        if (deck.userId != userId) {
            return res.status(403).json({ error: 'Le deck n\'appartient pas a l\'user' })
        }

        return res.status(200).json(deck)
    }
    catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})



/**
 * Route PATCH /api/decks/:id
 * 
 * Modifie un deck existant.
 * Met à jour le nom et/ou les cartes du deck.
 * Note: L'implémentation actuelle supprime et recrée le deck et ses associations.
 * 
 * @param {Request} req - L'objet Request d'Express.
 *  - params.deckId: L'ID du deck à modifier.
 *  - body.name: Le nouveau nom du deck.
 *  - body.cards: La nouvelle liste d'IDs de cartes (doit contenir 10 cartes valides).
 *  - userId: Ajouté par le middleware d'authentification.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 200: Succès, retourne le nouveau deck créé.
 *  - 400: Données invalides (nom manquant, nombre de cartes incorrect, cartes inexistantes).
 *  - 401: Utilisateur non authentifié.
 *  - 403: Le deck n'appartient pas à l'utilisateur.
 *  - 404: Le deck n'existe pas.
 *  - 500: Erreur serveur interne.
 */
decksRouter.patch('/:deckId', authenticateToken, async (req: Request, res: Response) => {
    const deckId = parseInt(req.params.deckId);
    const { name, cards } = req.body

    try {
        // récupération de l'id du client authentifier : 
        const userId = req.userId

        if (!userId) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' })
        }

        // vérification que le deck appartient a l'user identifier : 
        const deck = await prisma.deck.findFirst({
            where: {
                id: deckId,
            },
            include: {
                cards: true
            }
        })

        if (!deck) {
            return res.status(404).json({ error: 'Le deck n\'existe pas' })
        }

        if (deck.userId != userId) {
            return res.status(403).json({ error: 'Le deck n\'appartient pas a l\'user' })
        }

        // modification des information du deck : 
        // vérification qu'il y a 10 cards : 
        if (cards.length !== 10) {
            return res.status(400).json({ error: 'Le deck doit contenir 10 cartes' })
        }

        // vérification que les carte existe : 
        const cardsTrouver = await prisma.card.findMany({
            where: {
                pokedexNumber: {
                    in: cards
                }
            }
        })

        if (cardsTrouver.length !== cards.length) {
            return res.status(400).json({ error: 'certaine carte n\'existe pas' })
        }

        // vérification name 
        if (!name) {
            return res.status(400).json({ error: 'il n\'y a pas le nom du deck' })
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
                        cardId: cardId
                    }))
                }
            },
        });

        return res.status(200).json(newDeck);
    }
    catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})



/**
 * Route DELETE /api/decks/:id
 * 
 * Supprime définitivement un deck.
 * Vérifie que le deck existe et appartient à l'utilisateur connecté avant de le supprimer.
 * 
 * @param {Request} req - L'objet Request d'Express.
 *  - params.deckId: L'ID du deck à supprimer.
 *  - userId: Ajouté par le middleware d'authentification.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 200: Succès, retourne les infos du deck supprimé.
 *  - 401: Utilisateur non authentifié.
 *  - 403: Le deck n'appartient pas à l'utilisateur.
 *  - 404: Le deck n'existe pas.
 *  - 500: Erreur serveur interne.
 */
decksRouter.delete('/:deckId', authenticateToken, async (req: Request, res: Response) => {
    const deckId = parseInt(req.params.deckId);

    try {
        // récupération de l'id du client authentifier : 
        const userId = req.userId

        if (!userId) {
            return res.status(401).json({ error: 'Utilisateur non authentifié' })
        }

        // vérification que le deck appartient a l'user identifier : 
        const deck = await prisma.deck.findFirst({
            where: {
                id: deckId,
            },
            include: {
                cards: true
            }
        })

        if (!deck) {
            return res.status(404).json({ error: 'Le deck n\'existe pas' })
        }

        if (deck.userId != userId) {
            return res.status(403).json({ error: 'Le deck n\'appartient pas a l\'user' })
        }

        // suppression de l'ancien deck : 
        await prisma.deckCard.deleteMany({
            where: { deckId: deckId },
        })

        await prisma.deck.delete({
            where: { id: deckId },
        })

        return res.status(200).json(deck);
    }
    catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})
