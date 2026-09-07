import fs from 'fs';
import { execSync } from 'child_process';

const envFile = fs.readFileSync('.env.local', 'utf-8');
const env = { ...process.env };
for (const line of envFile.split('\n')) {
    if (line.includes('=')) {
        const [k, v] = line.split('=');
        env[k.trim()] = v.trim().replace(/^"|"$/g, '');
    }
}
// Set IMAGEKIT_PRIVATE_KEY from our known secrets
env.IMAGEKIT_PRIVATE_KEY = "df72b3fa0a017ffa49907b923217f86b64a80eac4dfef8c906772388b18f9dd3";
execSync('node scripts/migrate_hotlinks_to_imagekit.mjs --properties=15', { env, stdio: 'inherit' });
