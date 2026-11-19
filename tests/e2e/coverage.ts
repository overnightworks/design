import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type BrowserContext, type Page } from '@playwright/test';

declare global {
	interface Window {
		__coverage__?: object;
		reportCoverage?: (coverage: string) => Promise<void>;
	}
}

const driveDirectory = fileURLToPath(new URL('../../coverage/drive', import.meta.url));

/** Collects the counters of every page of the contexts it watches. */
export interface DriveCoverage {
	/** Starts collecting from a context a spec opened itself. */
	watch(context: BrowserContext): Promise<void>;
}

function leavesTheDocument(error: Error): undefined {
	if (error.message.includes('Execution context was destroyed')) {
		return undefined;
	}
	throw error;
}

// The instrumented consumer counts in `window.__coverage__`, which each page load
// starts afresh. A document reports its counters as it hides, and a page the test
// ends on reports them once more at teardown; `pnpm run coverage:merge` adds them to
// Vitest's.
export const test = base.extend<{ driveCoverage: DriveCoverage }>({
	driveCoverage: [
		async ({ context }, use, testInfo) => {
			const reports: string[] = [];
			const pages: Page[] = [];
			const watch = async (watched: BrowserContext) => {
				await watched.exposeBinding('reportCoverage', (_source, coverage: string) => {
					reports.push(coverage);
				});
				await watched.addInitScript(() => {
					addEventListener('pagehide', () => {
						if (window.__coverage__) {
							void window.reportCoverage?.(JSON.stringify(window.__coverage__));
						}
					});
				});
				pages.push(...watched.pages());
				watched.on('page', (page) => pages.push(page));
			};
			await watch(context);
			await use({ watch });
			for (const page of pages) {
				// A page still leaving its document destroys the context this reads; that
				// document reports through its own `pagehide`, so only a navigation is let go.
				const last = await page
					.waitForLoadState('domcontentloaded')
					.then(() => page.evaluate(() => JSON.stringify(window.__coverage__ ?? null)))
					.catch((error: Error) => (page.isClosed() ? 'null' : leavesTheDocument(error)));
				if (last && last !== 'null') {
					reports.push(last);
				}
			}
			mkdirSync(driveDirectory, { recursive: true });
			reports.forEach((coverage, index) => {
				writeFileSync(`${driveDirectory}/${testInfo.testId}-${testInfo.project.name}-${testInfo.retry}-${index}.json`, coverage);
			});
		},
		{ auto: true }
	]
});

export { expect };
