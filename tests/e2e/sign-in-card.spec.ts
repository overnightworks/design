import { expect, test, type Locator } from '@playwright/test';
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
	'font-weight',
	'width',
	'display'
] as const;
const cardProperties = [...boxProperties, 'flex-direction', 'align-items', 'gap', 'text-align'] as const;
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
				test(`a hand-written ${state} action looks like the component's, hovered and focused, in ${colorScheme}`, async ({
					page
				}) => {
					await page.emulateMedia({ colorScheme });
					await routeTo(page.context(), outDir);
					await page.goto(`${origin}/?sign-in-card=${state}`);

					const written = page.locator('#written').getByRole(role, { name: words[name] });
					const component = page.locator('#component').getByRole(role, { name: words[name] });
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

					await page.mouse.move(0, 0);
					await written.hover();
					const hoveredWritten = await computedOf(written, actionProperties);
					await component.hover();
					const hoveredComponent = await computedOf(component, actionProperties);
					expect(hoveredWritten).toEqual(hoveredComponent);
				});
			}
		}
	});
}
