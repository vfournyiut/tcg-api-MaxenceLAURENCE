import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import { join } from "path";
import { prisma } from "../src/database";
import { CardModel } from "../src/generated/prisma/models/Card";
import { PokemonType } from "../src/generated/prisma/enums";

async function main() {
    console.log("🌱 Starting database seed...");

    await prisma.deckCard.deleteMany();
    await prisma.deck.deleteMany();
    await prisma.card.deleteMany();
    await prisma.user.deleteMany();

    const hashedPassword = await bcrypt.hash("password123", 10);

    await prisma.user.createMany({
        data: [
            {
                username: "red",
                email: "red@example.com",
                password: hashedPassword,
            },
            {
                username: "blue",
                email: "blue@example.com",
                password: hashedPassword,
            },
        ],
    });

    const redUser = await prisma.user.findUnique({ where: { email: "red@example.com" } });
    const blueUser = await prisma.user.findUnique({ where: { email: "blue@example.com" } });

    if (!redUser || !blueUser) {
        throw new Error("Failed to create users");
    }

    console.log("✅ Created users:", redUser.username, blueUser.username);

    const pokemonDataPath = join(__dirname, "data", "pokemon.json");
    const pokemonJson = readFileSync(pokemonDataPath, "utf-8");
    const pokemonData: CardModel[] = JSON.parse(pokemonJson);

    const createdCards = await Promise.all(
        pokemonData.map((pokemon) =>
            prisma.card.create({
                data: {
                    name: pokemon.name,
                    hp: pokemon.hp,
                    attack: pokemon.attack,
                    type: PokemonType[pokemon.type as keyof typeof PokemonType],
                    pokedexNumber: pokemon.pokedexNumber,
                    imgUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokemon.pokedexNumber}.png`,
                },
            })
        )
    );

    console.log(`✅ Created ${pokemonData.length} Pokemon cards`);

    await prisma.deck.createMany({ // création des decks 
        data: [
            {
                name: "Starter Deck",
                userId: redUser.id,
            },
            {
                name: "Starter Deck",
                userId: blueUser.id,
            },
        ],
    });

    console.log("✅ Created decks:", redUser.username, blueUser.username);

    const redDeck = await prisma.deck.findFirst({ where: { userId: redUser.id } }); // Récupérer les id car autoincrémentation (donc pas forcément 1 et 2 !!) 
    const blueDeck = await prisma.deck.findFirst({ where: { userId: blueUser.id } });

    if (!redDeck || !blueDeck) {
        throw new Error("Decks not found");
    }

    const redDeckCards = Array.from({ length: 10 }).map(() => { // 10 carte aléatoire pour le deck de l'user rouge
        const randomCard = createdCards[Math.floor(Math.random() * createdCards.length)];
        return {
            deckId: redDeck.id, // l'id du deck de l'user rouge
            cardId: randomCard.id, // carte aléatoire
        };
    });

    const blueDeckCards = Array.from({ length: 10 }).map(() => { // 10 carte aléatoire pour le deck de l'user bleu 
        const randomCard = createdCards[Math.floor(Math.random() * createdCards.length)];
        return {
            deckId: blueDeck.id, // l'id du deck de l'user bleu
            cardId: randomCard.id, // carte aléatoire
        };
    });

    await prisma.deckCard.createMany({
        data: [...redDeckCards, ...blueDeckCards], // les "..." = les 10 élément de redDeckCards et blueDeckCards
    });

    console.log("✅ Created deckcards");

    console.log("\n🎉 Database seeding completed!");
}

main()
    .catch((e) => {
        console.error("❌ Error seeding database:", e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
