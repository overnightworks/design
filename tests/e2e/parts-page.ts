import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AddressInfo } from 'node:net';
import type { KitLanguage } from 'overnightworks-design/words';
import { preview } from 'vite';
import { buildConsumer, colorSchemes, copyStylesheet, languages, tarball } from './build-consumer.ts';
import { parts, variants, variantsOf, type Part, type Variant } from './variants.ts';

const here = dirname(fileURLToPath(import.meta.url));

/** The built parts page; it is neither `dist/` nor published. */
export const partsPageDirectory = join(here, '.parts-page');

/** The built consumer the page's frames load, beside the page's own files. */
const consumerDirectory = 'consumer';

/** How each kit language names itself on the language switch. */
const languageNames: Record<KitLanguage, string> = { de: 'Deutsch', en: 'English' };

const themeNames = { light: 'Light', dark: 'Dark' } as const satisfies Record<(typeof colorSchemes)[number], string>;

const escape = (text: string): string =>
	text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');

const pageName = (part: Part): string => `${part.id}.html`;

/** The consumer page of one state, as a frame loads it, from a page one directory below the root. */
export function frameAddress(variant: Variant, theme: (typeof colorSchemes)[number], language: KitLanguage): string {
	const query = [variant.query, `theme=${theme}`, `lang=${language}`].filter(Boolean).join('&');
	return `../${consumerDirectory}/index.html?${query}`;
}

function frame(variant: Variant, theme: (typeof colorSchemes)[number], language: KitLanguage, style?: string): string {
	const title = `${variant.part.name}: ${variant.label}, ${themeNames[theme].toLowerCase()}`;
	return `<iframe src="${escape(frameAddress(variant, theme, language))}" title="${escape(title)}"${style ? ` style="${style}"` : ''}></iframe>`;
}

function languageSwitch(language: KitLanguage, file: string): string {
	const links = languages
		.map((other) => `<a href="../${other}/${file}"${other === language ? ' aria-current="true"' : ''}>${languageNames[other]}</a>`)
		.join('');
	return `<nav class="switch" aria-label="Language of the parts">${links}</nav>`;
}

function pageDocument(title: string, body: string): string {
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escape(title)}</title>
<link rel="stylesheet" href="../design.css">
<link rel="stylesheet" href="../parts-page.css">
</head>
<body>
<div class="page">
${body}
<footer>Built from ${escape(basename(tarball()))}. The page is static and runs nothing but the parts themselves.</footer>
</div>
</body>
</html>
`;
}

/** What the index says it was built from: the checkout's version, on demand, from a tarball packed from it. */
export const builtOnDemandSentence = (version: string): string =>
	`Every shared part in each of its states, light and dark. Built on demand from a tarball packed from this checkout, version ${version}: the very tarball the apps install.`;

const stateCount = (count: number): string => `${count} ${count === 1 ? 'state' : 'states'}`;

function indexPage(language: KitLanguage, version: string): string {
	const tiles = parts
		.map((part) => {
			const [first] = variantsOf(part);
			const thumbs = colorSchemes
				.map((theme) => `<div>${frame(first, theme, language)}</div>`)
				.join('');
			return `<a class="part" href="${pageName(part)}"><div class="thumb">${thumbs}</div><div class="label"><h2>${escape(part.name)}</h2><span class="count">${stateCount(variantsOf(part).length)}</span></div></a>`;
		})
		.join('\n');
	return pageDocument(
		`design ${version}`,
		`<header class="top">
<div><h1>design ${escape(version)}</h1><p>${escape(builtOnDemandSentence(version))}</p></div>
${languageSwitch(language, 'index.html')}
</header>
<ul class="facts"><li>${parts.length} parts</li><li>${variants.length} states</li><li>${colorSchemes.length} themes</li><li>${languages.length} languages</li></ul>
<section class="parts" aria-label="Parts">
${tiles}
</section>`
	);
}

function partPage(language: KitLanguage, part: Part): string {
	const sections = variantsOf(part)
		.map((variant) => {
			const pair = colorSchemes
				.map((theme) => {
					const address = escape(frameAddress(variant, theme, language));
					return `<div class="frame" data-theme="${theme}"><div class="bar"><span>${themeNames[theme]}</span><a href="${address}" target="_blank" rel="noopener">open alone ↗</a></div>${frame(variant, theme, language, `height: ${part.frameHeight}px`)}</div>`;
				})
				.join('\n');
			return `<section class="variant"><h3>${escape(variant.label)} <code>${escape(variant.query || 'default')}</code></h3><div class="pair">
${pair}
</div></section>`;
		})
		.join('\n');
	return pageDocument(
		`${part.name} · design parts`,
		`<nav class="crumbs"><a href="index.html">All parts</a> / ${escape(part.name)}</nav>
<header class="top">
<div><h1>${escape(part.name)}</h1><p>${escape(part.summary)} Each state light and dark; open a frame alone to try it by keyboard.</p></div>
${languageSwitch(language, pageName(part))}
</header>
${sections}`
	);
}

/** The version of the checkout the page is built from. */
export const checkoutVersion = (): string =>
	(JSON.parse(readFileSync(join(here, '../../package.json'), 'utf8')) as { version: string }).version;

/** The page opens in German, as the blessed picture shows; English is one switch away. */
export const openingLanguage: KitLanguage = 'de';

function entryPage(): string {
	const address = `${openingLanguage}/index.html`;
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta http-equiv="refresh" content="0; url=${address}">
<title>design parts</title>
</head>
<body><a href="${address}">${languageNames[openingLanguage]}</a></body>
</html>
`;
}

/**
 * Builds the parts page from the packed tarball: the `imported` consumer without counters and with a
 * relative base, then one index and one page per part in every kit language, each state a frame of
 * that consumer in each theme.
 */
export async function buildPartsPage(): Promise<string> {
	const version = checkoutVersion();
	rmSync(partsPageDirectory, { recursive: true, force: true });
	await buildConsumer('imported', { outDir: join(partsPageDirectory, consumerDirectory), counters: false, base: './' });
	copyStylesheet(partsPageDirectory);
	cpSync(join(here, 'parts-page.css'), join(partsPageDirectory, 'parts-page.css'));
	writeFileSync(join(partsPageDirectory, 'index.html'), entryPage());
	for (const language of languages) {
		mkdirSync(join(partsPageDirectory, language), { recursive: true });
		writeFileSync(join(partsPageDirectory, language, 'index.html'), indexPage(language, version));
		for (const part of parts) {
			writeFileSync(join(partsPageDirectory, language, pageName(part)), partPage(language, part));
		}
	}
	return partsPageDirectory;
}

/** Serves the built page on loopback only, because its frames load module scripts a file address cannot; `close` ends the server. */
export async function servePartsPage(): Promise<{ address: string; close: () => Promise<void> }> {
	const server = await preview({
		configFile: false,
		logLevel: 'warn',
		build: { outDir: partsPageDirectory },
		appType: 'mpa',
		preview: { host: '127.0.0.1', port: 0 }
	});
	const { address: host, port } = server.httpServer.address() as AddressInfo;
	return { address: `http://${host}:${port}`, close: () => server.close() };
}
