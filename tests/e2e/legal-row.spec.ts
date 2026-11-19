import { expect, test } from './coverage.ts';
import type { Locator } from '@playwright/test';
import { colorSchemes, consumerNames, consumerTitle, languages, origin, useConsumer, widths } from './build-consumer.ts';
import { resolveStyle } from './probe.ts';

const rowProperties = ['display', 'flex-wrap', 'justify-content', 'gap', 'font-size'] as const;
const linkProperties = ['color', 'border-bottom-color', 'border-bottom-style', 'border-bottom-width'] as const;

const computedOf = (element: Locator, properties: readonly string[]) =>
	element.evaluate((node, names) => {
		const style = getComputedStyle(node);
		return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
	}, properties);

for (const consumer of consumerNames) {
	test.describe(consumerTitle('the legal row', consumer), () => {
		const { wordsOf, route } = useConsumer(consumer);

		for (const language of languages) {
			for (const width of widths) {
				test(`names both rows in the ${language} words at ${width} px`, async ({ page }) => {
					await page.setViewportSize({ width, height: 800 });
					await route(page.context());
					await page.goto(`${origin}/?legal&lang=${language}`);
					await expect(page.locator('html')).toHaveAttribute('lang', language);
					await expect(page.getByRole('navigation', { name: wordsOf[language]['legalLinks.name'] })).toHaveCount(2);
				});
			}
		}

		for (const colorScheme of colorSchemes) {
			test(`a hand-written legal row looks like the component's in ${colorScheme}`, async ({ page }) => {
				await page.emulateMedia({ colorScheme });
				await route(page.context());
				await page.goto(`${origin}/?legal`);

				const written = page.locator('#written nav');
				const component = page.locator('#component nav');
				await expect(written.getByRole('link')).toHaveCount(2);
				expect(await computedOf(written, rowProperties)).toEqual(
					await computedOf(component, rowProperties)
				);
				expect(await computedOf(written.getByRole('link').first(), linkProperties)).toEqual(
					await computedOf(component.getByRole('link').first(), linkProperties)
				);

				const probes = await resolveStyle(
					page,
					{ color: 'var(--text-muted)', 'border-bottom': '1px solid var(--border)' },
					['color', 'border-bottom-color']
				);
				const link = written.getByRole('link').first();
				await expect(link).toHaveCSS('color', probes.color);
				await expect(link).toHaveCSS('border-bottom-color', probes['border-bottom-color']);
			});

			test(`a hovered legal link looks the same in both rows and takes the text colour in ${colorScheme}`, async ({
				page
			}) => {
				await page.emulateMedia({ colorScheme });
				await route(page.context());
				await page.goto(`${origin}/?legal`);

				const written = page.locator('#written nav').getByRole('link').first();
				const component = page.locator('#component nav').getByRole('link').first();
				const resting = await computedOf(written, linkProperties);

				await written.hover();
				const hoveredWritten = await computedOf(written, linkProperties);
				await component.hover();
				const hoveredComponent = await computedOf(component, linkProperties);

				const { color: text } = await resolveStyle(page, { color: 'var(--text)' }, ['color']);
				expect(hoveredWritten).toEqual(hoveredComponent);
				expect(hoveredWritten.color).toBe(text);
				expect(hoveredWritten['border-bottom-color']).toBe(text);
				expect(hoveredWritten.color).not.toBe(resting.color);
			});
		}
	});
}
