import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, normalize, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import type { BrowserContext, Page } from '@playwright/test';
import type { KitLanguage, KitWords } from 'overnightworks-design/words';
import { createInstrumenter } from 'istanbul-lib-instrument';
import { build } from 'vite';
import istanbul from 'vite-plugin-istanbul';
import { languages } from '../../src/lib/words/index.ts';
import { test } from './coverage.ts';

const consumersRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(consumersRoot, '../..');
const packDirectory = join(consumersRoot, '.pack');

/** The origin the routed pages answer to. */
export const origin = 'http://consumer.test';

export type ConsumerName = 'imported' | 'linked';

let tarballPath: string | undefined;

/** The tarball a consumer installs: the working tree packed by pnpm. */
export function tarball(): string {
	if (!tarballPath) {
		rmSync(packDirectory, { recursive: true, force: true });
		mkdirSync(packDirectory, { recursive: true });
		execFileSync('pnpm', ['pack', '--pack-destination', packDirectory], {
			cwd: repositoryRoot,
			stdio: 'pipe'
		});
		tarballPath = join(packDirectory, readdirSync(packDirectory).find((name) => name.endsWith('.tgz'))!);
	}
	return tarballPath;
}

/** Lays the tarball out as `npm install` does, under node_modules, where both consumers resolve it. */
function installPackage(): void {
	const installed = join(consumersRoot, 'node_modules/overnightworks-design');
	rmSync(installed, { recursive: true, force: true });
	mkdirSync(installed, { recursive: true });
	execFileSync('tar', ['-xzf', tarball(), '-C', installed, '--strip-components=1']);
}

const kitDirectory = join(consumersRoot, 'node_modules/overnightworks-design');
const kitSourceDirectory = join(repositoryRoot, 'src/lib');

interface InputSourceMap {
	sources?: string[];
}

/**
 * Istanbul's own instrumenter, with the input source map's sources rewritten to the
 * file's twin under `src/lib`, which is where the merged report counts the component.
 * It refuses a `.svelte` file whose installed copy differs from that twin, because the
 * counters would then name lines of a file that is not the one measured.
 */
function kitInstrumenter() {
	const instrumenter = createInstrumenter({
		coverageGlobalScopeFunc: false,
		coverageGlobalScope: 'globalThis',
		preserveComments: true,
		produceSourceMap: true,
		autoWrap: true,
		esModules: true,
		compact: false
	});
	return {
		instrumentSync(code: string, filename: string, inputSourceMap?: InputSourceMap): string {
			const twin = join(kitSourceDirectory, relative(join(kitDirectory, 'svelte-dist'), filename));
			if (!readFileSync(filename).equals(readFileSync(twin))) {
				throw new Error(`${filename} differs from ${twin}; the coverage of the kit would name the wrong lines.`);
			}
			if (inputSourceMap?.sources) {
				inputSourceMap.sources = inputSourceMap.sources.map(() => twin);
			}
			return instrumenter.instrumentSync(code, filename, inputSourceMap as never);
		},
		lastSourceMap: () => instrumenter.lastSourceMap(),
		get fileCoverage() {
			return instrumenter.fileCoverage;
		}
	};
}

/** Copies the kit's stylesheet and fonts into a directory, untouched, bypassing the bundler, as a page that links it holds them. */
export function copyStylesheet(directory: string): void {
	const stylesheet = createRequire(join(consumersRoot, 'package.json')).resolve('overnightworks-design/design.css');
	cpSync(stylesheet, join(directory, 'design.css'));
	cpSync(join(dirname(stylesheet), 'fonts'), join(directory, 'fonts'), { recursive: true });
}

/** Where a consumer is built and how: the specs measure it, the parts page does not. */
export interface ConsumerBuild {
	outDir?: string;
	/** Istanbul counters in the kit's components and a source map; the tarball itself never carries them. */
	counters?: boolean;
	/** The base the built page's assets are addressed from; `./` lets a directory be served anywhere. */
	base?: string;
}

/** Builds the consumer for production and returns its output directory. */
export async function buildConsumer(
	name: ConsumerName,
	{ outDir = join(consumersRoot, name, 'dist'), counters = true, base = '/' }: ConsumerBuild = {}
): Promise<string> {
	installPackage();
	await build({
		root: join(consumersRoot, name),
		configFile: false,
		logLevel: 'warn',
		base,
		plugins: [
			svelte(),
			...(counters
				? [
						istanbul({
							cwd: kitDirectory,
							include: ['svelte-dist/**'],
							extension: ['.svelte'],
							forceBuildInstrument: true,
							instrumenter: kitInstrumenter()
						})
					]
				: [])
		],
		build: { outDir, emptyOutDir: true, sourcemap: counters }
	});
	if (name === 'linked') copyStylesheet(outDir);
	return outDir;
}

/** Serves a built consumer through request routing, so no server process exists. */
export async function routeTo(target: Page | BrowserContext, outDir: string): Promise<void> {
	await target.route(`${origin}/**`, async (route) => {
		const { pathname } = new URL(route.request().url());
		const file = normalize(join(outDir, pathname === '/' ? 'index.html' : pathname));
		if (!file.startsWith(outDir + sep) || !existsSync(file) || !statSync(file).isFile()) {
			return route.fulfill({ status: 404 });
		}
		return route.fulfill({ path: file });
	});
}

/** What a prerendering `load` does under Node: the kit's words export, imported by name, then the words of one language. */
export async function loadKitWordsUnderNode(language: KitLanguage): Promise<KitWords> {
	installPackage();
	const { loadKitWords } = await import('overnightworks-design/words');
	return loadKitWords(language);
}

export const colorSchemes = ['light', 'dark'] as const;
export const widths = [390, 1280] as const;
/** Every language the kit ships words in, from the generated list. */
export { languages };
export const consumerNames = ['imported', 'linked'] as const satisfies readonly ConsumerName[];

/** The describe title every spec gives to one of its consumers. */
export function consumerTitle(subject: string, name: ConsumerName): string {
	return `${subject} in a production consumer that ${name === 'imported' ? 'imports' : 'statically links'} design.css`;
}

/**
 * Builds a consumer once before the tests of the enclosing describe, loads the kit's words in
 * every language unless the spec reads none, and hands back what the tests drive it with.
 * The words are filled in place before the first test, so a spec may hold `en` while it defines its tests.
 * `open` routes the page to the consumer and loads the variant `query` names in `language`.
 */
export function useConsumer(name: ConsumerName, { words = true } = {}) {
	let outDir: string;
	const wordsOf: Record<KitLanguage, KitWords> = { de: {} as KitWords, en: {} as KitWords };
	test.beforeAll(async () => {
		outDir = await buildConsumer(name);
		if (words) {
			for (const language of languages) {
				Object.assign(wordsOf[language], await loadKitWordsUnderNode(language));
			}
		}
	});
	const route = (target: Page | BrowserContext) => routeTo(target, outDir);
	async function open(page: Page, query: string, language: KitLanguage = 'en'): Promise<void> {
		await route(page.context());
		await page.goto(`${origin}/?${query}${language === 'en' ? '' : `&lang=${language}`}`);
	}
	return { wordsOf, en: wordsOf.en, route, open };
}
