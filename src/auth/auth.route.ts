import bcrypt from 'bcrypt'
import { Request, Response, Router } from 'express'
import jwt from 'jsonwebtoken'

import { prisma } from '../database'
import { authenticateToken } from './auth.middleware'

export const authRouter = Router()

// Route pour tester le middleware d'authentification
authRouter.get(
  '/test-auth',
  authenticateToken,
  (req: Request, res: Response) => {
    res
      .status(200)
      .json({ message: 'Authenticated', userId: req.userId, email: req.email })
  },
)

// POST /api/auth/sign-up
// création d'un user
authRouter.post('/sign-up', async (req: Request, res: Response) => {
  const { email, username, password } = req.body

  try {
    // 1. vérification unicité du mail
    if (!email) {
      return res.status(400).json({ error: 'Email manquant' })
    }

    const emailUnique = !(await prisma.user.findUnique({
      // email unique = PAS dans la base
      where: { email },
    }))

    if (!emailUnique) {
      // si l'email n'est pas unique
      return res.status(409).json({ error: "L'email déja utiliser" })
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

    const usernameUnique = !(await prisma.user.findUnique({
      // username unique = PAS dans la base
      where: { username },
    }))

    if (!usernameUnique) {
      // si l'username n'est pas unique
      return res.status(409).json({ error: "L'username déja utiliser" })
    }

    // 4. écriture en base de donnée
    const user = await prisma.user.create({
      data: {
        username: username,
        email: email,
        password: hashPassword,
      },
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

// POST /api/auth/sign-in
// connexion
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
