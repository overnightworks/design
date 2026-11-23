import { existsSync } from 'node:fs';
import type { FrameLocator } from '@playwright/test';
import { expect, test } from './coverage.ts';
import { colorSchemes, languages, origin, routeTo } from './build-consumer.ts';
import { frameAddress, partsPageDirectory } from './parts-page.ts';
import { parts, variantsOf, type Variant } from './variants.ts';

type Language = (typeof languages)[number];
type Theme = (typeof colorSchemes)[number];

/** A frame shows the part its state belongs to, in its theme and language, with something rendered; a state that names its own words keeps them. */
async function expectFrameRenders(frame: FrameLocator, variant: Variant, theme: Theme, language: Language): Promise<void> {
	const html = frame.locator('html');
	await expect(html).toHaveAttribute('data-part', variant.part.id);
	await expect(html).toHaveAttribute('data-theme', theme);
	await expect(html).toHaveAttribute('lang', new URLSearchParams(variant.query).get('words') ?? language);
	await expect(frame.locator('body > *').first()).toBeAttached();
}

test.describe('the built parts page', () => {
	test.beforeAll(() => {
		// `pnpm run build:parts-page` builds the page from the tarball; this spec reads that output.
		expect(existsSync(partsPageDirectory), 'run pnpm run build:parts-page first').toBe(true);
	});
	test.beforeEach(({ page }) => routeTo(page.context(), partsPageDirectory));

	test('the front door opens the German index and keeps the English link on the language switch', async ({ page }) => {
		await page.goto(`${origin}/index.html`);
		await expect(page).toHaveURL(`${origin}/de/index.html`);
		await expect(page.locator('nav.switch a[aria-current="true"]')).toHaveText('Deutsch');
		await expect(page.locator('nav.switch a[href="../en/index.html"]')).toBeVisible();
	});

	for (const language of languages) {
		test(`the index in ${language} links every part and shows its first state in light and dark`, async ({ page }) => {
			await page.goto(`${origin}/${language}/index.html`);
			for (const part of parts) {
				await expect(page.locator(`a.part[href="${part.id}.html"]`)).toContainText(part.name);
				for (const theme of colorSchemes) {
					const address = frameAddress(variantsOf(part)[0], theme, language);
					await expectFrameRenders(
						page.frameLocator(`a.part[href="${part.id}.html"] iframe[src="${address}"]`),
						variantsOf(part)[0],
						theme,
						language
					);
				}
			}
		});

		for (const part of parts) {
			test(`the ${part.name} page in ${language} shows each of its states in light and dark`, async ({ page }) => {
				await page.goto(`${origin}/${language}/${part.id}.html`);
				for (const variant of variantsOf(part)) {
					for (const theme of colorSchemes) {
						const address = frameAddress(variant, theme, language);
						await expectFrameRenders(page.frameLocator(`iframe[src="${address}"]`), variant, theme, language);
					}
				}
				await expect(page.locator('section.variant')).toHaveCount(variantsOf(part).length);
			});
		}
	}
});
