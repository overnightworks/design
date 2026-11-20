import { expect, test } from './coverage.ts';
import type { Locator, Page } from '@playwright/test';
import type { KitLanguage } from 'overnightworks-design';
import { colorSchemes, consumerNames, consumerTitle, languages, useConsumer, widths } from './build-consumer.ts';
import { numberOf, resolveStyle } from './probe.ts';

// AiMark.svelte holds the word as a constant for every language, so no catalog key exists (gap named on #276).
const aiMarkWord = 'AI';

const reportsOf = (page: Page) => page.evaluate(() => window.reports);
// The bubble, the AI mark and the tool row have no role: the bubble is the message's content after its speaker line,
// the mark the element worded with the AI mark word, the tool row the parent of the line that names its tool.
const bubbleOf = (page: Page, text: string) => page.getByRole('listitem').filter({ hasText: text }).locator(':scope > *').nth(1);
const aiMarkIn = (scope: Locator) => scope.getByText(aiMarkWord, { exact: true });
const rowOf = (page: Page, tool: string) => page.getByText(tool).first().locator('..');

for (const consumer of consumerNames) {
	test.describe(consumerTitle('the helper chat', consumer), () => {
		const { wordsOf, open: openAt } = useConsumer(consumer);

		const fieldOf = (page: Page, language: KitLanguage = 'en'): Locator =>
			page.getByRole('textbox', { name: wordsOf[language]['helperChat.composerLabel']({ name: 'Mozart' }), exact: true });
		const messageOf = (page: Page, text: string): Locator =>
			page.getByRole('list', { name: wordsOf.en['helperChat.listLabel']({ name: 'Mozart' }), exact: true }).getByRole('listitem').filter({ hasText: text });
		const sendOf = (page: Page, language: KitLanguage = 'en'): Locator =>
			page.getByRole('button', { name: wordsOf[language]['helperChat.send'], exact: true });

		async function open(page: Page, variant: string, language: KitLanguage = 'en'): Promise<void> {
			await openAt(page, `helper=${variant}`, language);
			await expect(fieldOf(page, language)).toBeVisible();
		}

		for (const language of languages) {
			for (const colorScheme of colorSchemes) {
				for (const width of widths) {
					test(`draws the bubbles, the tool rows and the composer from the fixed values and the app accent, in ${colorScheme} at ${width} px in the ${language} words`, async ({
						page
					}) => {
						await page.emulateMedia({ colorScheme });
						await page.setViewportSize({ width, height: 800 });
						await open(page, 'base', language);
						const tokens = await resolveStyle(
							page,
							{
								color: 'var(--accent)',
								'background-color': 'var(--on-accent)',
								'border-top-color': 'var(--text-muted)',
								'font-family': 'var(--font-display)'
							},
							['color', 'background-color', 'border-top-color', 'font-family']
						);
						const send = sendOf(page, language);
						const field = fieldOf(page, language);

						await expect(send).toHaveCSS('background-color', tokens.color);
						await expect(send).toHaveCSS('color', tokens['background-color']);
						await expect(send).toHaveCSS('font-family', tokens['font-family']);
						await expect(send).toHaveCSS('text-transform', 'uppercase');
						const bubble = bubbleOf(page, 'Make the second verse');
						const radiusOf = (element: Locator) => numberOf(element, 'border-top-left-radius');
						expect(await radiusOf(send)).toBeLessThan(await radiusOf(field));
						expect(await radiusOf(field)).toBeLessThan(await radiusOf(bubble));
						await expect(bubble).toHaveCSS('background-color', tokens.color);
						expect((await field.boundingBox())!.height).toBeGreaterThanOrEqual(44);
						const sendBox = (await send.boundingBox())!;
						expect(sendBox.height).toBeGreaterThanOrEqual(44);
						expect(sendBox.width).toBeGreaterThanOrEqual(44);

						const row = rowOf(page, 'rewrite_section');
						await expect(row).toHaveCSS('color', tokens['border-top-color']);
						expect(await numberOf(row, 'font-size')).toBeLessThan(await numberOf(bubble, 'font-size'));
						expect(await row.evaluate((node) => getComputedStyle(node).fontFamily)).toContain('ui-monospace');

						expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
					});

					test(`draws a disabled field as muted text on the deep background and a disabled Send dimmer than the field, in ${colorScheme} at ${width} px in the ${language} words`, async ({
						page
					}) => {
						await page.emulateMedia({ colorScheme });
						await page.setViewportSize({ width, height: 800 });
						await open(page, 'archived', language);
						const tokens = await resolveStyle(
							page,
							{ color: 'var(--text-muted)', 'background-color': 'var(--bg-deep)' },
							['color', 'background-color']
						);
						await expect(fieldOf(page, language)).toBeDisabled();
						await expect(fieldOf(page, language)).toHaveCSS('color', tokens.color);
						await expect(fieldOf(page, language)).toHaveCSS('background-color', tokens['background-color']);
						await expect(sendOf(page, language)).toBeDisabled();
						expect(await numberOf(sendOf(page, language), 'opacity')).toBeLessThan(
							await numberOf(fieldOf(page, language), 'opacity')
						);
					});

					test(`wraps a long tool target and keeps the composer inside the page, in ${colorScheme} at ${width} px in the ${language} words`, async ({
						page
					}) => {
						await page.emulateMedia({ colorScheme });
						await page.setViewportSize({ width, height: 800 });
						await open(page, 'base', language);
						const target = page.locator('.target', { hasText: 'Bridge of a long-named' });
						await expect(target).toBeVisible();
						const bubble = (await bubbleOf(page, 'Bridge of a long-named').boundingBox())!;
						const box = (await target.boundingBox())!;
						expect(box.x + box.width).toBeLessThanOrEqual(bubble.x + bubble.width + 1);
						const send = (await sendOf(page, language).boundingBox())!;
						expect(send.x + send.width).toBeLessThanOrEqual(width);
					});
				}
			}
		}

		for (const language of languages) {
			test(`reads its kit words, its tool row and its thinking line in the ${language} words`, async ({ page }) => {
				const words = wordsOf[language];
				await open(page, 'base', language);
				await expect(page.locator('html')).toHaveAttribute('lang', language);
				await expect(sendOf(page, language)).toBeVisible();
				await expect(rowOf(page, 'rewrite_section')).toContainText(words['helperChat.ranTool']({ tool: 'rewrite_section' }));

				await open(page, 'running', language);
				await expect(page.getByRole('status')).toHaveText(words['helperChat.thinking']({ name: 'Mozart' }));

				await open(page, 'loading', language);
				await expect(page.getByText(words['helperChat.loading'], { exact: true })).toBeVisible();
			});
		}

		test('leads each helper message with the AI mark before its tool rows and gives the person none', async ({ page }) => {
			await open(page, 'base');
			const helper = bubbleOf(page, 'I shortened it');
			await expect(aiMarkIn(helper)).toHaveCount(1);
			const mark = (await aiMarkIn(helper).elementHandle())!;
			const row = (await rowOf(page, 'rewrite_section').elementHandle())!;
			const marked = await helper.evaluate(
				(node, [markNode, rowNode]) =>
					Boolean(markNode.compareDocumentPosition(rowNode) & Node.DOCUMENT_POSITION_FOLLOWING) && node.firstElementChild!.contains(markNode),
				[mark, row],
			);
			expect(marked).toBe(true);
			await expect(aiMarkIn(bubbleOf(page, 'Make the second verse'))).toHaveCount(0);
		});

		for (const language of languages) {
			test(`tells the person's messages from the helper's by the speaker line in the ${language} words`, async ({ page }) => {
				const words = wordsOf[language];
				await open(page, 'base', language);
				const messages = page.getByRole('list', { name: words['helperChat.listLabel']({ name: 'Mozart' }), exact: true }).getByRole('listitem');
				const you = words['helperChat.speaker']({ name: words['helperChat.you'] });
				const mozart = words['helperChat.speaker']({ name: 'Mozart' });
				await expect(messages).toHaveCount(4);
				const speakers = await messages.evaluateAll((items) => items.map((item) => item.firstElementChild?.textContent));
				expect(speakers).toEqual([you, mozart, you, mozart]);
			});
		}

		test('shows message text as written, with its line breaks', async ({ page }) => {
			await open(page, 'base');
			const person = bubbleOf(page, 'Make the second verse').getByText('Make the second verse');
			await expect(person).toHaveCSS('white-space', 'pre-wrap');
			expect((await person.boundingBox())!.height).toBeGreaterThan(30);
		});

		test('shows the tool row with the input as its title, the app’s target and the foreign mark with its title', async ({ page }) => {
			await open(page, 'base');
			await expect(rowOf(page, 'rewrite_section')).toHaveAttribute('title', '{"title":"Verse 2","foreign":false}');
			await expect(rowOf(page, 'rewrite_section').locator('.target')).toHaveText('in Verse 2');
			await expect(rowOf(page, 'add_line').locator('[title="Someone else\'s song"]')).toBeVisible();
			await expect(rowOf(page, 'rewrite_section').locator('[title="Someone else\'s song"]')).toHaveCount(0);
		});

		test('shows the empty hint while there is no message', async ({ page }) => {
			await open(page, 'empty');
			const hint = page.getByText('Ask Mozart about your song.');
			await expect(hint).toBeVisible();
			const tokens = await resolveStyle(page, { color: 'var(--text-muted)' }, ['color']);
			await expect(hint).toHaveCSS('color', tokens.color);
		});

		test('shows the loading word or the failure alert instead of the list and keeps the composer', async ({ page }) => {
			await open(page, 'loading');
			await expect(page.getByText(wordsOf.en['helperChat.loading'], { exact: true })).toBeVisible();
			await expect(page.getByText('Make the second verse')).toHaveCount(0);

			await open(page, 'failed');
			await expect(page.getByRole('alert')).toHaveText('The conversation could not be loaded.');
			await expect(sendOf(page)).toBeVisible();
		});

		test('shows the app’s problem line after the message it belongs to and reports its retry', async ({ page }) => {
			await open(page, 'problem');
			const message = messageOf(page, 'I got as far as');
			await expect(message.getByRole('alert')).toContainText('Mozart stopped.');
			await message.getByRole('button', { name: 'Try again' }).click();
			expect(await reportsOf(page)).toEqual(['retry']);
			await expect(messageOf(page, 'Make the second verse').getByRole('alert')).toHaveCount(0);
		});

		test('shows the archived banner with its button above the composer and disables the composer', async ({ page }) => {
			await open(page, 'archived');
			const banner = page.getByText('This song is archived.');
			await expect(banner).toBeVisible();
			expect((await banner.boundingBox())!.y).toBeLessThan((await fieldOf(page).boundingBox())!.y);
			await page.getByRole('button', { name: 'Restore it' }).click();
			expect(await reportsOf(page)).toEqual(['restore']);
		});

		test('hands the message list to the app, which restores its place, and reports scrolling', async ({ page }) => {
			await open(page, 'scroll');
			const list = page.getByRole('list').locator('xpath=..');
			await expect.poll(() => list.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
			await list.evaluate((node) => {
				node.scrollTop = 0;
			});
			await expect.poll(() => reportsOf(page)).toContain('scroll:false');
		});

		test('keeps the one thinking line while the answer grows and the turn ends, changing only its text', async ({ page }) => {
			await open(page, 'running');
			const line = page.getByRole('status');
			await expect(line).toHaveCount(1);
			await expect(line).toHaveText(wordsOf.en['helperChat.thinking']({ name: 'Mozart' }));
			const handle = await line.elementHandle();

			await page.locator('#grow').click();
			await expect(page.getByText('Here is a shorter verse.')).toBeVisible();
			await expect(line).toHaveText('');
			await page.locator('#finish').click();
			expect(await handle!.evaluate((node) => node.isConnected)).toBe(true);
			await expect(page.getByRole('status')).toHaveCount(1);
		});

		test('sends the trimmed draft on Enter and on Send, and makes a new line on Shift+Enter', async ({ page }) => {
			await open(page, 'base');
			const field = fieldOf(page);
			await field.fill('  Hello  ');
			await field.press('Enter');
			await expect(field).toHaveValue('');
			expect(await reportsOf(page)).toEqual(['send:Hello']);

			await field.fill('Line one');
			await field.press('Shift+Enter');
			await field.pressSequentially('Line two');
			await expect(field).toHaveValue('Line one\nLine two');
			expect(await reportsOf(page)).toEqual(['send:Hello']);

			await sendOf(page).click();
			expect(await reportsOf(page)).toEqual(['send:Hello', 'send:Line one\nLine two']);
		});

		test('cancels a plain Enter without sending while the draft is empty and while a turn runs', async ({ page }) => {
			await open(page, 'base');
			const field = fieldOf(page);
			await field.press('Enter');
			await expect(field).toHaveValue('');
			await expect(sendOf(page)).toBeDisabled();

			await open(page, 'running');
			await field.fill('Another');
			await expect(sendOf(page)).toBeDisabled();
			await field.press('Enter');
			await expect(field).toHaveValue('Another');
			expect(await reportsOf(page)).toEqual([]);
		});

		test('picks from the app’s pick list on ArrowDown then Enter without sending', async ({ page }) => {
			await open(page, 'base');
			const field = fieldOf(page);
			await field.pressSequentially('Hi @');
			const list = page.getByRole('listbox', { name: 'People' });
			await expect(list.getByRole('option')).toHaveCount(3);
			await expect(list.getByRole('option').first()).toHaveAttribute('aria-selected', 'true');
			await field.press('ArrowDown');
			await expect(list.getByRole('option', { name: 'Bach' })).toHaveAttribute('aria-selected', 'true');
			await field.press('Enter');
			expect(await reportsOf(page)).toEqual(['pick:Bach']);
			await expect(field).toHaveValue('Hi ');
			await expect(page.getByRole('button', { name: 'Bach ×' })).toBeVisible();
			await expect(list).toHaveCount(0);

			await page.getByRole('button', { name: 'Bach ×' }).click();
			expect(await reportsOf(page)).toEqual(['pick:Bach', 'untag:Bach']);
		});

		test('places the pick list inside the composer box above the field and keeps the focus in the field when it is pressed', async ({
			page
		}) => {
			await open(page, 'base');
			const field = fieldOf(page);
			await field.pressSequentially('@');
			const option = page.getByRole('option', { name: 'Clara' });
			const optionBox = (await option.boundingBox())!;
			const fieldBox = (await field.boundingBox())!;
			expect(optionBox.y + optionBox.height).toBeLessThanOrEqual(fieldBox.y);
			expect(optionBox.x).toBeGreaterThanOrEqual(fieldBox.x - 1);
			await option.click();
			await expect(field).toBeFocused();
			expect(await reportsOf(page)).toEqual(['pick:Clara']);
		});

		test('keeps the focus in the field when Send is pressed', async ({ page }) => {
			await open(page, 'draft');
			await fieldOf(page).focus();
			await sendOf(page).click();
			await expect(fieldOf(page)).toBeFocused();
			expect(await reportsOf(page)).toEqual(['send:A first line\nA second line']);
		});
	});
}
