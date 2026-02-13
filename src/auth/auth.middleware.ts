import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'

// Étendre le type Request pour ajouter userId et email
declare global {
    namespace Express {
        interface Request {
            userId?: number
            email?: string
        }
    }
}

/**
 * Middleware d'authentification JWT.
 * 
 * Vérifie la présence et la validité du token JWT dans l'en-tête Authorization.
 * Si le token est valide, ajoute les informations de l'utilisateur (userId, email) à l'objet Request.
 * 
 * @param {Request} req - L'objet Request d'Express.
 * @param {Response} res - L'objet Response d'Express.
 * @param {NextFunction} next - La fonction NextFunction d'Express.
 * @returns {void | Response} Passe au middleware suivant via `next()` ou retourne une réponse 401.
 * 
 * @throws {401} Token manquant ou invalide/expiré.
 */
export const authenticateToken = (
    req: Request,
    res: Response,
    next: NextFunction,
) => {
    // 1. Récupérer le token depuis l'en-tête Authorization
    const authHeader = req.headers.authorization
    const token = authHeader && authHeader.split(' ')[1] // Format: "Bearer TOKEN"

    if (!token) {
        return res.status(401).json({ error: 'Token manquant' })
    }

    try {
        // 2. Vérifier et décoder le token
        const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as {
            userId: number
            email: string
        }

        // 3. Ajouter userId et email à la requête pour l'utiliser dans les routes
        req.userId = decoded.userId
        req.email = decoded.email

        // 4. Passer au prochain middleware ou à la route
        return next()
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré' })
    }
}
