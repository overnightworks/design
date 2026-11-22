import { AxeBuilder } from '@axe-core/playwright';
import { expect, test } from './coverage.ts';
import { colorSchemes, consumerNames, consumerTitle, useConsumer } from './build-consumer.ts';

const wcagTags = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];

/** Every query variant the consumers render, by part. */
const variantsByPart: Record<string, string[]> = {
	'the sign-in page': ['', 'signing-in', 'window-blocked', 'unfinished', 'login-failed', 'no-access', 'on-sign-in'],
	'the hand-written sign-in card and legal row': ['sign-in-card=signed-out', 'sign-in-card=no-access', 'legal'],
	'the account menu': ['menu=default', 'menu=action', 'menu=no-theme', 'menu=ignore'],
	'the agent control': [
		'agents=default',
		'agents=ended-no-answer',
		'agents=ended-busy',
		'agents=ended-owner-absent',
		'agents=full',
		'agents=full-place-full',
		'agents=refusal',
		'agents=empty',
		'agents=empty-full',
		'agents=empty-refusal',
		'agents=empty-place-full'
	],
	'the turn state': ['turn=alone', 'turn=here'],
	'the hearing switch': [
		'hearing=hear',
		'hearing=listen',
		'hearing=see',
		'hearing=hear,off',
		'hearing=listen,off',
		'hearing=see,off',
		'hearing=hear,compact',
		'hearing=narrow',
		'hearing=hear,listen,see,row',
		'hearing=hear,listen,see,reverse',
		'hearing=hear,listen,see,compact,row,reverse'
	],
	'the ear mark': ['ear=one', 'ear=two', 'ear=long'],
	'the helper chat': [
		'helper=base',
		'helper=empty',
		'helper=scroll',
		'helper=running',
		'helper=problem',
		'helper=loading',
		'helper=failed',
		'helper=draft',
		'helper=archived'
	],
	'the marked sentence': ['marked']
};

for (const consumer of consumerNames) {
	test.describe(consumerTitle('every variant', consumer), () => {
		const { open } = useConsumer(consumer);

		for (const [part, variants] of Object.entries(variantsByPart)) {
			for (const variant of variants) {
				for (const colorScheme of colorSchemes) {
					test(`${part} (${variant || 'default'}) has no WCAG 2.2 AA violation in ${colorScheme}`, async ({ page }) => {
						await page.emulateMedia({ colorScheme });
						await open(page, variant);
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
		}
	});
}
