import { Request, Response, Router } from 'express'

import { authenticateToken } from '../auth/auth.middleware'
import { prisma } from '../database'

export const cardsRouter = Router()

// GET /api/cards
// Retourne la liste des cards
cardsRouter.get('', authenticateToken, async (_req: Request, res: Response) => {
  // faire authenticateToken puis ensuite notre fonction :
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
