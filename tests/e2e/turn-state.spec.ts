import { expect, test } from './coverage.ts';
import type { Locator, Page } from '@playwright/test';
import type { KitLanguage, KitWords } from 'overnightworks-design';
import { colorSchemes, consumerNames, consumerTitle, languages, useConsumer, widths } from './build-consumer.ts';
import { resolveStyle } from './probe.ts';

const longName = 'Leonardo da Vinci, the long-named painter and inventor';

/** The part has no role: it is found by the kit's word for any of its four outcomes. */
function turnStatesIn(scope: Page | Locator, words: KitWords): Locator {
	return (['turnState.notEnabled', 'turnState.busy', 'turnState.budgetSpent', 'turnState.unavailable'] as const)
		.map((key) => scope.getByText(words[key], { exact: true }))
		.reduce((found, next) => found.or(next));
}

for (const consumer of consumerNames) {
	test.describe(consumerTitle('the turn state', consumer), () => {
		const { wordsOf, open: openAt } = useConsumer(consumer);

		async function open(page: Page, variant: string, language: KitLanguage = 'en'): Promise<void> {
			await openAt(page, `turn=${variant}`, language);
			await expect(turnStatesIn(page, wordsOf[language]).first()).toBeVisible();
		}

		for (const language of languages) {
			test(`words each stated outcome in the ${language} words and draws nothing for an unstated one`, async ({ page }) => {
				await open(page, 'alone', language);
				const words = wordsOf[language];
				const parts = turnStatesIn(page, words);
				await expect(parts).toHaveText([
					words['turnState.notEnabled'],
					words['turnState.busy'],
					words['turnState.budgetSpent'],
					words['turnState.unavailable']
				]);
				await expect(page.locator('.turn-stage > div').last()).toBeEmpty();
				await expect(parts.first().locator('svg')).toHaveAttribute('aria-hidden', 'true');
			});
		}

		for (const colorScheme of colorSchemes) {
			for (const width of widths) {
				test(`paints the part in the muted ink on one line, in ${colorScheme} at ${width} px`, async ({ page }) => {
					await page.emulateMedia({ colorScheme });
					await page.setViewportSize({ width, height: 800 });
					await open(page, 'alone');
					const tokens = await resolveStyle(page, { color: 'var(--text-muted)' }, ['color']);
					const part = turnStatesIn(page, wordsOf.en).first();
					await expect(part).toHaveCSS('color', tokens.color);
					await expect(part).toHaveCSS('white-space', 'nowrap');
					const box = (await part.boundingBox())!;
					const markBox = (await part.locator('svg').boundingBox())!;
					expect(markBox.width).toBeGreaterThan(0);
					expect(box.height).toBeLessThan(2 * markBox.height);
				});

				test(`keeps the part whole and the leave button inside the row beside a long name, in ${colorScheme} at ${width} px`, async ({ page }) => {
					await page.emulateMedia({ colorScheme });
					await page.setViewportSize({ width, height: 800 });
					await open(page, 'here');
					const rows = page.getByRole('listitem');
					await expect(rows).toHaveCount(3);

					const long = rows.nth(1);
					const name = long.getByText(longName, { exact: true });
					await expect(name).toHaveCSS('text-overflow', 'ellipsis');
					expect(await name.evaluate((node) => node.scrollWidth > node.clientWidth)).toBe(true);
					const part = turnStatesIn(long, wordsOf.en);
					const partBox = (await part.boundingBox())!;
					const rowBox = (await long.boundingBox())!;
					expect(partBox.x).toBeGreaterThanOrEqual(rowBox.x);
					expect(partBox.x + partBox.width).toBeLessThanOrEqual(rowBox.x + rowBox.width);
					expect(await part.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
					const rowInnerRight = await long.evaluate((node) => {
						const box = node.getBoundingClientRect();
						return box.right - parseFloat(getComputedStyle(node).paddingRight);
					});
					for (const row of [rows.first(), long]) {
						const rowPart = (await turnStatesIn(row, wordsOf.en).boundingBox())!;
						const button = (await row.getByRole('button').boundingBox())!;
						const clearOfPart = rowPart.x + rowPart.width <= button.x || rowPart.y + rowPart.height <= button.y;
						expect(clearOfPart).toBe(true);
						expect(button.x + button.width).toBeLessThanOrEqual(rowInnerRight);
					}
					expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

					await expect(turnStatesIn(rows.nth(2), wordsOf.en)).toHaveCount(0);
					await expect(turnStatesIn(rows.first(), wordsOf.en)).toHaveText(wordsOf.en['turnState.busy']);
				});
			}
		}
	});
}
