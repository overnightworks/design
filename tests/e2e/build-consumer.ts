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

const consumersRoot = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(consumersRoot, '../..');
const packDirectory = join(consumersRoot, '.pack');

export const origin = 'http://consumer.test';

export type ConsumerName = 'imported' | 'linked';

let tarballPath: string | undefined;

/** The tarball a consumer installs: the working tree packed by pnpm. */
function tarball(): string {
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

/** Builds the consumer for production and returns its output directory. */
export async function buildConsumer(name: ConsumerName): Promise<string> {
	const consumerDirectory = join(consumersRoot, name);
	const outDir = join(consumerDirectory, 'dist');
	installPackage();
	await build({
		root: consumerDirectory,
		configFile: false,
		logLevel: 'warn',
		// The counters live only in this build: the tarball above is what the release path packs.
		plugins: [
			svelte(),
			istanbul({
				cwd: kitDirectory,
				include: ['svelte-dist/**'],
				extension: ['.svelte'],
				forceBuildInstrument: true,
				instrumenter: kitInstrumenter()
			})
		],
		build: { outDir, emptyOutDir: true, sourcemap: true }
	});
	if (name === 'linked') {
		// A linked stylesheet is copied into the page's origin untouched, bypassing the bundler.
		const stylesheet = createRequire(join(consumersRoot, 'package.json')).resolve(
			'overnightworks-design/design.css'
		);
		cpSync(stylesheet, join(outDir, 'design.css'));
		cpSync(join(dirname(stylesheet), 'fonts'), join(outDir, 'fonts'), { recursive: true });
	}
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
