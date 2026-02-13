import { Request, Response, Router } from 'express'
import { prisma } from "../database";
import bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { authenticateToken } from './auth.middleware'

export const authRouter = Router()

/**
 * Route GET /api/auth/test-auth
 * 
 * Route de test pour vérifier si le token JWT est valide.
 * Nécessite l'authentification middleware `authenticateToken`.
 * 
 * @param {Request} req - L'objet Request d'Express. Contient `userId` et `email` ajoutés par le middleware.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response} 200 OK avec le message et les infos utilisateur décodées du token.
 */
authRouter.get('/test-auth', authenticateToken, (req: Request, res: Response) => {
    res.status(200).json({ message: 'Authenticated', userId: req.userId, email: req.email })
})


/**
 * Route POST /api/auth/sign-up
 * 
 * Crée un nouvel utilisateur.
 * Hash le mot de passe et stocke l'utilisateur en base de données.
 * 
 * @param {Request} req - L'objet Request d'Express. Contient `email`, `username`, et `password` dans le body.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response}
 *  - 201: Utilisateur créé avec succès. Retourne le token et les infos utilisateur.
 *  - 400: Données manquantes (email, username, ou password).
 *  - 409: Conflit, email ou username déjà utilisé.
 *  - 500: Erreur serveur interne.
 */
authRouter.post('/sign-up', async (req: Request, res: Response) => {
    const { email, username, password } = req.body

    try {
        // 1. vérification unicité du mail 
        if (!email) {
            return res.status(400).json({ error: 'Email manquant' })
        }

        const emailUnique = !await prisma.user.findUnique({ // email unique = PAS dans la base
            where: { email }
        })

        if (!emailUnique) { // si l'email n'est pas unique 
            return res.status(409).json({ error: 'L\'email déja utiliser' })
        }


        // 2. hash du mot de passe 
        if (!password) {
            return res.status(400).json({ error: 'Password manquant' })
        }

        const hashPassword = await bcrypt.hash(password, 10)


        // 3. vérification username
        if (!username) {
            return res.status(400).json({ error: 'Username manquant' })
        }

        const usernameUnique = !await prisma.user.findUnique({ // username unique = PAS dans la base
            where: { username }
        })

        if (!usernameUnique) { // si l'username n'est pas unique 
            return res.status(409).json({ error: 'L\'username déja utiliser' })
        }


        // 4. écriture en base de donnée 
        const user = await prisma.user.create({
            data: {
                username: username,
                email: email,
                password: hashPassword
            }
        })


        // 5. tocken JWT 
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '7d' },
        )


        // 6. Retourner le token
        return res.status(201).json({
            message: 'User crée',
            token,
            user: {
                id: user.id,
                name: user.username,
                email: user.email,
            },
        })
    } catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})




/**
 * Route POST /api/auth/sign-in
 * 
 * Authentifie un utilisateur existant.
 * Vérifie l'email et le mot de passe, puis génère et retourne un token JWT.
 * 
 * @param {Request} req - L'objet Request d'Express. Contient `email` et `password` dans le body.
 * @param {Response} res - L'objet Response d'Express.
 * @returns {Response} 
 *  - 200: Connexion réussie, retourne le token et les infos utilisateur.
 *  - 400: Email ou mot de passe manquant.
 *  - 401: Email ou mot de passe incorrect (authentification échouée).
 *  - 500: Erreur serveur interne.
 */
authRouter.post('/sign-in', async (req: Request, res: Response) => {
    const { email, password } = req.body

    try {
        // 1. Vérifier que l'utilisateur existe
        if (!email) {
            return res.status(400).json({ error: 'Email manquant' })
        }
        const user = await prisma.user.findUnique({
            where: { email },
        })

        if (!user) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
        }


        // 2. Vérifier le mot de passe
        if (!password) {
            return res.status(400).json({ error: 'Password manquant' })
        }
        const isPasswordValid = await bcrypt.compare(password, user.password)

        if (!isPasswordValid) {
            return res.status(401).json({ error: 'Email ou mot de passe incorrect' })
        }


        // 3. Générer le JWT
        const token = jwt.sign(
            {
                userId: user.id,
                email: user.email,
            },
            process.env.JWT_SECRET as string,
            { expiresIn: '1h' }, // Le token expire dans 1 heure
        )


        // 4. Retourner le token
        return res.status(200).json({
            message: 'Connexion réussie',
            token,
            user: {
                id: user.id,
                name: user.username,
                email: user.email,
            },
        })
    } catch (error) {
        console.error('Erreur lors de la connexion:', error)
        return res.status(500).json({ error: 'Erreur serveur' })
    }
})