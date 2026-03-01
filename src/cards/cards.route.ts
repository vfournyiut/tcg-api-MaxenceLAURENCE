import { Request, Response, Router } from 'express'

import { authenticateToken } from '../auth/auth.middleware'
import { prisma } from '../database'

export const cardsRouter = Router()

/**
 * Route GET /api/cards
 * 
 * Récupère la liste de toutes les cartes.
 * Nécessite l'authentification middleware `authenticateToken`.
 * 
 * @param {Request} _req - L'objet Request d'Express (inutilisé).
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 200: Succès, retourne la liste des cartes triée par numéro de pokedex.
 *  - 500: Erreur serveur interne.
 */
cardsRouter.get('', authenticateToken, async (_req: Request, res: Response) => { // faire authenticateToken puis ensuite notre fonction : 
    try {
        const cardsList = await prisma.card.findMany({
            orderBy: {
                pokedexNumber: 'asc',
            },
        })

        return res.status(200).json({ cardsList })
    } catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})
