import { createServer } from "http";
import { env } from "./env";
import { authRouter } from "./auth/auth.route";
import { cardsRouter } from "./cards/cards.route";
import { decksRouter } from "./decks/decks.route";
import express from "express";
import cors from "cors";

// Create Express app
export const app = express()

// Middlewares
app.use(
  cors({
    origin: true, // Autorise toutes les origines
    credentials: true,
  }),
)

app.use(express.json())

// Serve static files (Socket.io test client)
app.use(express.static('public'))

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'TCG Backend Server is running' })
})

// Utilisation du router utilisateur
app.use('/api/auth', authRouter)

// Utilisation du router cards
app.use('/api/cards', cardsRouter)

// Utilisation du router decks 
app.use('/api/decks', decksRouter)


// Start server only if this file is run directly (not imported for tests)
if (require.main === module) {
  // Create HTTP server
  const httpServer = createServer(app)

  // Start server
  try {
    httpServer.listen(env.PORT, () => {
      console.log(`\n🚀 Server is running on http://localhost:${env.PORT}`)
      console.log(
        `🧪 Socket.io Test Client available at http://localhost:${env.PORT}`,
      )
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}
