const fs = require('fs');
const path = require('path');

// Read environment variable from Vercel / CI or use fallback
const apiUrl = process.env.API_URL || process.env.BACKEND_URL || 'https://nepal-fund.onrender.com';

const targetPath = path.join(__dirname, 'src/environments/environment.prod.ts');

const envConfigFile = `export const environment = {
  production: true,
  apiUrl: '${apiUrl.trim()}'
};
`;

fs.writeFileSync(targetPath, envConfigFile, 'utf8');
console.log(`[set-env] Injected apiUrl: "${apiUrl}" into environment.prod.ts`);
