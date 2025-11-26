import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const buildFilePath = join(__dirname, 'build.json');

// Read current build number
const buildData = JSON.parse(readFileSync(buildFilePath, 'utf8'));
const newBuildNumber = buildData.buildNumber + 1;

// Update build number
buildData.buildNumber = newBuildNumber;
writeFileSync(buildFilePath, JSON.stringify(buildData, null, 2) + '\n');

console.log(`Build number incremented to: ${newBuildNumber}`);
