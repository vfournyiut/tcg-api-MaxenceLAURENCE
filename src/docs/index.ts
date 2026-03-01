import YAML from 'yamljs'
import path from 'path'

// __dirname is already available in commonjs

// Charger la configuration principale
const swaggerConfig = YAML.load(path.join(__dirname, 'swagger.config.yml'))

// Charger les documentations des modules
const authDoc = YAML.load(path.join(__dirname, 'auth.doc.yml'))
const cardDoc = YAML.load(path.join(__dirname, 'card.doc.yml'))
const deckDoc = YAML.load(path.join(__dirname, 'deck.doc.yml'))

// Fusionner tous les paths
export const swaggerDocument = {
    ...swaggerConfig,
    paths: {
        ...authDoc.paths,
        ...cardDoc.paths,
        ...deckDoc.paths
    }
}
