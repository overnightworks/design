import { expect, test } from './coverage.ts';
import { expectNoWcagViolations } from './axe.ts';
import { colorSchemes, consumerNames, consumerTitle, useConsumer } from './build-consumer.ts';
import { variants } from './variants.ts';

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
					await expectNoWcagViolations(page);
				});
			}
		}
	});
}
