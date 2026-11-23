import { AxeBuilder } from '@axe-core/playwright';
import type { Page } from '@playwright/test';
import { expect } from './coverage.ts';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Runs axe over the page as it is and expects no violation and no colour contrast axe could not decide. */
export async function expectNoWcagViolations(page: Page): Promise<void> {
	const { violations, incomplete } = await new AxeBuilder({ page }).withTags(wcagTags).analyze();
	expect(
		violations.map(({ id, nodes }) => ({
			id,
			nodes: nodes.map(({ target, any }) => ({ target, data: any.map(({ data }) => data) }))
		}))
	).toEqual([]);
	expect(incomplete.filter(({ id }) => id === 'color-contrast').map(({ nodes }) => nodes.map(({ target, any }) => [target, any.map(({ data }) => data)]))).toEqual([]);
}
