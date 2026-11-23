import type { Locator, Page } from '@playwright/test';
import { expect } from './coverage.ts';

/** Resolves CSS declarations such as `{ color: 'var(--text)' }` to the computed values of the named properties. */
export function resolveStyle(
	page: Page,
	declarations: Record<string, string>,
	properties: readonly string[]
): Promise<Record<string, string>> {
	return page.evaluate(
		([declared, names]) => {
			const probe = document.createElement('div');
			for (const [name, value] of Object.entries(declared)) probe.style.setProperty(name, value);
			document.body.append(probe);
			const style = getComputedStyle(probe);
			const resolved = Object.fromEntries(names.map((name) => [name, style.getPropertyValue(name)]));
			probe.remove();
			return resolved;
		},
		[declarations, properties] as const
	);
}

/** The computed value of a length or number property of one element, as a number. */
export const numberOf = (element: Locator, property: string): Promise<number> =>
	element.evaluate((node, name) => parseFloat(getComputedStyle(node).getPropertyValue(name)), property);

/** The element shows the kit's own focus ring: a solid outline, not the browser's default one. */
export async function expectFocusRing(element: Locator): Promise<void> {
	await expect(element).toBeFocused();
	await expect(element).toHaveCSS('outline-style', 'solid');
	await expect(element).not.toHaveCSS('outline-width', '0px');
}
