import { buildPartsPage, openingLanguage, servePartsPage } from './parts-page.ts';

console.log(`Parts page built in ${await buildPartsPage()}`);
const { address, close } = await servePartsPage();
console.log(`Open ${address}/${openingLanguage}/index.html (Ctrl+C ends the server)`);
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void close().then(() => process.exit(0)));
