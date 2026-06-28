const fs = require('fs');
const path = require('path');

function loadEnvFile() {
    const envPath = path.join(__dirname, '..', '.env');
    if (!fs.existsSync(envPath)) return;

    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;

        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;

        const key = trimmed.slice(0, eq).trim();
        let value = trimmed.slice(eq + 1).trim();

        if (
            (value.startsWith('"') && value.endsWith('"')) ||
            (value.startsWith("'") && value.endsWith("'"))
        ) {
            value = value.slice(1, -1);
        }

        if (!process.env[key]) {
            process.env[key] = value;
        }
    }
}

loadEnvFile();

const url = process.env.SUPABASE_URL;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !anonKey) {
    console.error(
        'Missing SUPABASE_URL or SUPABASE_ANON_KEY.\n' +
        'Set them in Netlify env vars or in a local .env file, then run this script again.'
    );
    process.exit(1);
}

const outputPath = path.join(__dirname, '..', 'js', 'supabase-config.js');
const content = `// Auto-generated at build time — do not commit
window.__SUPABASE_CONFIG__ = {
    url: ${JSON.stringify(url)},
    anonKey: ${JSON.stringify(anonKey)}
};
`;

fs.writeFileSync(outputPath, content, 'utf8');
console.log('Generated js/supabase-config.js');
