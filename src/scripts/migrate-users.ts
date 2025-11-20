import { MongoClient } from 'mongodb';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement depuis le fichier .env
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function bootstrap() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri || !mongoUri.includes('pmsconnectdb')) {
    console.error(
      '❌ ERREUR : MONGODB_URI est manquant ou ne pointe pas vers pmsconnectdb dans votre .env',
    );
    console.log('URI actuelle:', mongoUri);
    return;
  }

  const client = new MongoClient(mongoUri);

  console.log('🚀 Début du script de migration Users...');

  try {
    await client.connect();
    const db = client.db(); // Le nom de la DB est déjà dans l'URI
    console.log('✅ Connecté à la base :', db.databaseName);

    const usersCollection = db.collection('users');
    console.log('Collection "users" chargée.');

    // --- Language ---
    const languageUpdate = await usersCollection.updateMany(
      { language: { $exists: false } },
      { $set: { language: 'en' } },
    );
    console.log(
      `[Language]    Matched: ${languageUpdate.matchedCount}, Updated: ${languageUpdate.modifiedCount}`,
    );

    // --- Bookmarks ---
    const bookmarksUpdate = await usersCollection.updateMany(
      { bookmarks: { $exists: false } },
      { $set: { bookmarks: [] } },
    );
    console.log(
      `[Bookmarks]   Matched: ${bookmarksUpdate.matchedCount}, Updated: ${bookmarksUpdate.modifiedCount}`,
    );

    // --- FCM Tokens ---
    const fcmTokensUpdate = await usersCollection.updateMany(
      { fcmTokens: { $exists: false } },
      { $set: { fcmTokens: [] } },
    );
    console.log(
      `[FCM Tokens]  Matched: ${fcmTokensUpdate.matchedCount}, Updated: ${fcmTokensUpdate.modifiedCount}`,
    );

    // --- Phone Number ---
    const phoneUpdate = await usersCollection.updateMany(
      { phoneNumber: { $exists: false } },
      { $set: { phoneNumber: '' } },
    );
    console.log(
      `[PhoneNumber] Matched: ${phoneUpdate.matchedCount}, Updated: ${phoneUpdate.modifiedCount}`,
    );

    console.log('🎉 Migration Users terminée avec succès !');
  } catch (error) {
    console.error('❌ Une erreur est survenue pendant la migration :', error);
  } finally {
    await client.close();
    console.log('Connexion à MongoDB fermée.');
  }
}

bootstrap();
