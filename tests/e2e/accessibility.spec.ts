import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './coverage.ts';
import { variants } from './variants.ts';
import { colorSchemes, consumerNames, consumerTitle, useConsumer } from './build-consumer.ts';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

for (const consumer of consumerNames) {
	test.describe(consumerTitle('every variant', consumer), () => {
		const { open } = useConsumer(consumer);

		for (const { part, query } of variants) {
			for (const colorScheme of colorSchemes) {
				test(`${part.name} (${query || 'default'}) has no WCAG 2.2 AA violation in ${colorScheme}`, async ({ page }) => {
					await page.emulateMedia({ colorScheme });
					await open(page, query);
					// The consumer mounts its parts after top-level awaits; axe over a body still empty finds nothing.
					await expect(page.locator('body > :not(script)').first()).toBeVisible();
					const { violations, incomplete } = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
					expect(
						violations.map(({ id, nodes }) => ({
							id,
							nodes: nodes.map(({ target, any }) => ({ target, data: any.map(({ data }) => data) }))
						}))
					).toEqual([]);
					expect(incomplete.filter(({ id }) => id === 'color-contrast').map(({ nodes }) => nodes.map(({ target, any }) => [target, any.map(({ data }) => data)]))).toEqual([]);
				});
			}
		}
	});
}
