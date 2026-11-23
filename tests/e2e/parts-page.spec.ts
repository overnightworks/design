import { existsSync } from 'node:fs';
import { expect, test } from './coverage.ts';
import { colorSchemes, languages, origin, routeTo } from './build-consumer.ts';
import { frameAddress, partsPageDirectory } from './parts-page.ts';
import { parts, variantsOf } from './variants.ts';

test.describe('the built parts page', () => {
	test.beforeAll(() => {
		// `pnpm run build:parts-page` builds the page from the tarball; this spec reads that output.
		expect(existsSync(partsPageDirectory), 'run pnpm run build:parts-page first').toBe(true);
	});
	test.beforeEach(({ page }) => routeTo(page.context(), partsPageDirectory));

	for (const language of languages) {
		test(`the index in ${language} links every part and shows its first state in light and dark`, async ({ page }) => {
			await page.goto(`${origin}/${language}/index.html`);
			for (const part of parts) {
				await expect(page.locator(`a.part[href="${part.id}.html"]`)).toContainText(part.name);
				for (const theme of colorSchemes) {
					const address = frameAddress(variantsOf(part)[0], theme, language);
					await expect(page.frameLocator(`a.part[href="${part.id}.html"] iframe[src="${address}"]`).locator('html')).toHaveAttribute(
						'data-theme',
						theme
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
						await expect(page.frameLocator(`iframe[src="${address}"]`).locator('html')).toHaveAttribute('data-theme', theme);
					}
				}
				await expect(page.locator('section.variant')).toHaveCount(variantsOf(part).length);
			});
		}
	}
});
