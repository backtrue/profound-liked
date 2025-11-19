import { getDecryptedApiKey } from './server/db.ts';

const userId = 1;
const provider = 'openai';

const decryptedKey = await getDecryptedApiKey(userId, provider);
console.log('Decrypted OpenAI API Key:');
console.log(decryptedKey);
