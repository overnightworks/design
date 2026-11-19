import { expect, test } from './coverage.ts';
import type { Locator } from '@playwright/test';
import type { KitWords } from 'overnightworks-design';
import { buildConsumer, loadKitWordsUnderNode, origin, routeTo, type ConsumerName } from './build-consumer.ts';

const colorSchemes = ['light', 'dark'] as const;
const sides = ['top', 'right', 'bottom', 'left'] as const;
const corners = ['top-left', 'top-right', 'bottom-right', 'bottom-left'] as const;
const boxProperties = [
	...sides.flatMap((side) => [`border-${side}-width`, `border-${side}-style`, `border-${side}-color`, `padding-${side}`]),
	...corners.map((corner) => `border-${corner}-radius`),
	'background-color',
	'color',
	'font-family',
	'font-size',
	'font-weight'
] as const;
const cardProperties = boxProperties;
const actionProperties = [
	...boxProperties,
	'min-height',
	'letter-spacing',
	'text-transform',
	'text-decoration-line',
	'cursor'
] as const;
const focusProperties = ['outline-width', 'outline-style', 'outline-color', 'outline-offset'] as const;

const computedOf = (element: Locator, properties: readonly string[]) =>
	element.evaluate((node, names) => {
		const style = getComputedStyle(node);
		return Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
	}, properties);

for (const consumer of ['imported', 'linked'] as const satisfies ConsumerName[]) {
	test.describe(`the sign-in card in a production consumer that ${consumer === 'imported' ? 'imports' : 'statically links'} design.css`, () => {
		let outDir: string;
		let words: KitWords;
		test.beforeAll(async () => {
			outDir = await buildConsumer(consumer);
			words = await loadKitWordsUnderNode('en');
		});

		for (const colorScheme of colorSchemes) {
			test(`a hand-written card looks like the component's in ${colorScheme}`, async ({ page }) => {
				await page.emulateMedia({ colorScheme });
				await routeTo(page.context(), outDir);
				await page.goto(`${origin}/?sign-in-card=signed-out`);

				const written = page.locator('#written').getByRole('main');
				const component = page.locator('#component').getByRole('main');
				await expect(written.getByRole('heading')).toHaveText(words['signIn.loggedOut']);
				expect(await computedOf(written, cardProperties)).toEqual(await computedOf(component, cardProperties));
			});

			for (const [state, role, name] of [
				['signed-out', 'link', 'signIn.logIn'],
				['no-access', 'button', 'signIn.logOut']
			] as const) {
				test(`a hand-written ${state} action looks like the component's, at rest and focused, in ${colorScheme}`, async ({
					page
				}) => {
					await page.emulateMedia({ colorScheme });
					await routeTo(page.context(), outDir);
					await page.goto(`${origin}/?sign-in-card=${state}`);

					const written = page.locator('#written').getByRole(role, { name: words[name], exact: true });
					const component = page.locator('#component').getByRole(role, { name: words[name], exact: true });
					const resting = await computedOf(component, actionProperties);
					expect(await computedOf(written, actionProperties)).toEqual(resting);

					await written.focus();
					await expect(written).toBeFocused();
					expect(await written.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
					const focusedWritten = await computedOf(written, [...actionProperties, ...focusProperties]);
					await component.focus();
					await expect(component).toBeFocused();
					expect(await component.evaluate((node) => node.matches(':focus-visible'))).toBe(true);
					const focusedComponent = await computedOf(component, [...actionProperties, ...focusProperties]);
					expect(focusedWritten).toEqual(focusedComponent);
					expect(focusedWritten['outline-style']).not.toBe('none');
				});
			}
		}

		test.describe('a card of wrapper elements takes no layout from the classes', () => {
			let written: Locator;
			test.beforeEach(async ({ page }) => {
				await routeTo(page.context(), outDir);
				await page.goto(`${origin}/?sign-in-card=signed-out`);
				written = page.locator('#written');
				await expect(written.getByRole('main')).toBeVisible();
			});

			test('the card is as wide as its container', async () => {
				const container = await written.evaluate((node) => node.clientWidth);
				const card = await written.getByRole('main').evaluate((node) => node.getBoundingClientRect().width);
				expect(card).toBe(container);
			});

			test("each direct child of the card is as wide as the card's content box", async () => {
				const widths = await written.getByRole('main').evaluate((card) => {
					const style = getComputedStyle(card);
					const content = card.clientWidth - Number.parseFloat(style.paddingLeft) - Number.parseFloat(style.paddingRight);
					return {
						content,
						children: [...card.children].map((child) => child.getBoundingClientRect().width)
					};
				});
				expect(widths.children).toEqual(widths.children.map(() => widths.content));
			});

			test("a label's text alignment equals that of an element outside the card", async () => {
				const outside = (await computedOf(written, ['text-align']))['text-align'];
				const label = (await computedOf(written.getByText('Name', { exact: true }), ['text-align']))['text-align'];
				expect(label).toBe(outside);
			});

			test('the two actions of a pair share a top and the second starts after the first ends', async () => {
				const pair = written.locator('form');
				const first = await pair.getByRole('link').evaluate((node) => node.getBoundingClientRect().toJSON());
				const second = await pair.getByRole('button').evaluate((node) => node.getBoundingClientRect().toJSON());
				expect(second.top).toBe(first.top);
				expect(second.left).toBeGreaterThanOrEqual(first.right);
			});

			test('a long label stays inside its action', async () => {
				const action = written.locator('#limited').getByRole('link');
				const fit = await action.evaluate((node) => ({
					scrollWidth: node.scrollWidth,
					clientWidth: node.clientWidth,
					borderBox: node.getBoundingClientRect().width,
					space: Number.parseFloat(getComputedStyle(node.parentElement!).width)
				}));
				expect(fit.scrollWidth).toBeLessThanOrEqual(fit.clientWidth);
				expect(fit.borderBox).toBeLessThanOrEqual(fit.space);
			});
		});
	});
}
