import { expect, test } from './coverage.ts';
import type { Locator } from '@playwright/test';
import { colorSchemes, consumerNames, consumerTitle, languages, origin, useConsumer, widths } from './build-consumer.ts';
import { expectFocusRing, resolveStyle } from './probe.ts';

for (const consumer of consumerNames) {
	test.describe(consumerTitle('the sign-in page', consumer), () => {
		const { en, wordsOf, route } = useConsumer(consumer);

		for (const colorScheme of colorSchemes) {
			test(`paints the sign-in grid, glows and legal row in ${colorScheme}`, async ({ page }) => {
				await page.emulateMedia({ colorScheme });
				await route(page);
				await page.goto(`${origin}/`);

				const card = page.getByRole('main');
				await expect(card.getByRole('heading')).toBeVisible();

				// No class names are read: the layers are the card's three earlier siblings (grid, then two
				// glows), so a decorative layer added to or removed from SignInPage must update this count.
				const layers = card.locator('xpath=preceding-sibling::*');
				await expect(layers).toHaveCount(3);
				const [grid, ...glows] = await layers.all();
				await expect(grid).toHaveCSS('mask-image', /gradient/);
				for (const glow of glows) {
					await expect(glow).toBeVisible();
					await expect(glow).not.toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
				}

				const viewport = page.viewportSize()!;
				for (const name of ['Imprint', 'Privacy']) {
					const link = page.getByRole('link', { name });
					await expect(link).toBeVisible();
					const box = (await link.boundingBox())!;
					expect(box.x).toBeGreaterThanOrEqual(0);
					expect(box.y).toBeGreaterThanOrEqual(0);
					expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
					expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
				}
			});
		}

		test('starts the app\'s own sign-in on a plain click and does not navigate', async ({ page }) => {
			await route(page);
			await page.goto(`${origin}/?on-sign-in`);

			await page.getByRole('link', { name: en['signIn.logIn'] }).click();
			expect(page.url()).toBe(`${origin}/?on-sign-in`);
			expect(await page.evaluate(() => window.reports)).toEqual(['sign-in']);
			await expect(page.getByRole('link')).toHaveCount(3);
		});

		// Each state's action: reached by the first Tab from the page start, drawn with the focus ring, started with Enter.
		// It reports to the app, opens the app in a new tab, or goes to the path.
		for (const [variant, key, outcome] of [
			['on-sign-in', 'signIn.logIn', 'report'],
			['unfinished', 'signIn.logIn', '/login'],
			['login-failed', 'signIn.tryAgain', '/login'],
			['signing-in', 'signIn.openInTab', 'tab'],
			['window-blocked', 'signIn.openInTab', 'tab'],
			['no-access', 'signIn.logOut', '/logout']
		] as const) {
			test(`reaches the ${variant} action by Tab, shows the focus ring and starts it with Enter`, async ({ page }) => {
				await route(page.context());
				await page.goto(`${origin}/?${variant}`);
				const main = page.getByRole('main');
				const action = main.getByRole('link').or(main.getByRole('button'));
				await expect(action).toHaveText(en[key]);

				await page.keyboard.press('Tab');
				await expectFocusRing(action);

				if (outcome === 'tab') {
					const [tab] = await Promise.all([page.context().waitForEvent('page'), page.keyboard.press('Enter')]);
					await expect(tab).toHaveURL(`${origin}/app`);
					return;
				}
				await page.keyboard.press('Enter');
				if (outcome === 'report') expect(await page.evaluate(() => window.reports)).toEqual(['sign-in']);
				else await expect(page).toHaveURL(`${origin}${outcome}`);
			});
		}

		for (const [name, click, navigatesThisPage] of [
			['a Ctrl-click', (link: Locator) => link.click({ modifiers: ['Control'] }), false],
			['a Meta-click', (link: Locator) => link.click({ modifiers: ['Meta'] }), true],
			['a middle click', (link: Locator) => link.click({ button: 'middle' }), false]
		] as const) {
			test(`leaves ${name} on the sign-in link to the browser`, async ({ page }) => {
				await route(page);
				await page.goto(`${origin}/?on-sign-in`);

				await click(page.getByRole('link', { name: en['signIn.logIn'] }));
				// Meta on Linux is no new-tab modifier: the browser follows the link in this page.
				if (navigatesThisPage) await expect(page).toHaveURL(`${origin}/login`);
				expect((await page.evaluate(() => window.reports)) ?? []).toEqual([]);
			});
		}

		test('keeps the dots of the waiting shape still under reduced motion and moves them otherwise', async ({
			page
		}) => {
			await route(page);
			await page.goto(`${origin}/?signing-in`);
			const dot = page.locator('main i').first();
			await page.emulateMedia({ reducedMotion: 'no-preference' });
			await expect(dot).not.toHaveCSS('animation-name', 'none');
			await page.emulateMedia({ reducedMotion: 'reduce' });
			await expect(dot).toHaveCSS('animation-name', 'none');
		});

		for (const language of languages) {
			for (const width of widths) {
				test(`shows every state in the ${language} words at ${width} px and keeps the page within the viewport`, async ({
					page
				}) => {
					await page.setViewportSize({ width, height: 800 });
					await route(page);
					const kit = wordsOf[language];
					for (const [variant, heading, action, alert] of [
						['', kit['signIn.loggedOut'], kit['signIn.logIn'], undefined],
						['unfinished', kit['signIn.loggedOut'], kit['signIn.logIn'], kit['signIn.signInUnfinished']],
						['signing-in', kit['signIn.signingIn'], kit['signIn.openInTab'], undefined],
						['window-blocked', kit['signIn.windowBlocked'], kit['signIn.openInTab'], undefined],
						['login-failed', kit['signIn.loginFailed'], kit['signIn.tryAgain'], kit['signIn.loginFailedBanner']],
						['no-access', kit['signIn.noAccess'], kit['signIn.logOut'], undefined]
					] as const) {
						await page.goto(`${origin}/?${variant}&lang=${language}`);
						await expect(page.locator('html')).toHaveAttribute('lang', language);
						const card = page.getByRole('main');
						await expect(card.getByRole('heading')).toHaveText(heading);
						await expect(card.getByRole('link').or(card.getByRole('button'))).toHaveText(action);
						if (alert) await expect(card.getByRole('alert')).toHaveText(alert);
						else await expect(card.getByRole('alert')).toHaveCount(0);
						await expect(page.getByRole('navigation', { name: kit['legalLinks.name'] })).toBeVisible();
						if (variant === 'no-access') {
							await expect(card.getByText(kit['signIn.noAccessSentence']({ appName: 'Probe' }))).toBeVisible();
						}
						expect(
							await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
						).toBe(true);
					}
				});
			}
		}

		for (const width of widths) {
			for (const colorScheme of colorSchemes) {
				for (const variant of ['signing-in', 'window-blocked', 'unfinished']) {
					test(`fits the ${variant} card at ${width} px in ${colorScheme}`, async ({ page }) => {
						await page.setViewportSize({ width, height: 800 });
						await page.emulateMedia({ colorScheme });
						await route(page);
						await page.goto(`${origin}/?${variant}`);

						const card = page.getByRole('main');
						await expect(card.getByRole('heading')).toBeVisible();
						const box = (await card.boundingBox())!;
						expect(box.x).toBeGreaterThanOrEqual(0);
						expect(box.x + box.width).toBeLessThanOrEqual(width);
						expect(
							await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)
						).toBe(true);
						if (variant === 'signing-in') {
							await expect(card.locator('svg').first()).toBeVisible();
							await expect(card.locator('i').first()).toBeVisible();
						} else if (variant === 'window-blocked') {
							await expect(card.getByRole('link')).toBeVisible();
							await expect(card.locator('i')).toHaveCount(0);
							await expect(card.getByRole('alert')).toHaveCount(0);
						} else {
							await expect(card.getByRole('alert')).toBeVisible();
						}
					});
				}
			}
		}

		for (const colorScheme of colorSchemes) {
			test(`draws the sign-in failure and the agent refusal with the same computed look in ${colorScheme} and each keeps its own placement`, async ({
				page
			}) => {
				await page.emulateMedia({ colorScheme });
				await route(page);
				const boxLooks = [
					'display', 'gap', 'align-items', 'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
					'border-top-color', 'border-top-width', 'border-left-width', 'border-top-left-radius',
					'background-color', 'font-size', 'text-align', 'color'
				];
				const markLooks = ['display', 'margin-top', 'color', 'width', 'height', 'background-color', 'clip-path'];
				// The computed looks of the banner, its sign and the sign's triangle; the width a parent gives it is placement.
				const shapeOf = (alert: Locator) =>
					alert.evaluate(
						(node, [boxProperties, markProperties]) => {
							const looks = (element: Element, properties: string[]) =>
								Object.fromEntries(properties.map((name) => [name, getComputedStyle(element).getPropertyValue(name)]));
							const sign = node.firstElementChild!;
							return [
								looks(node, boxProperties),
								looks(sign, markProperties.slice(0, 3)),
								looks(sign.firstElementChild!, markProperties.slice(3)),
								looks(node.lastElementChild!, ['font-size', 'color'])
							];
						},
						[boxLooks, markLooks]
					);
				// How far the banner sits inside the box that holds its wrapper, against what that box and the wrapper declare.
				const placement = (alert: Locator) =>
					alert.evaluate((node) => {
						const wrapper = node.parentElement!;
						const holder = wrapper.parentElement!;
						const box = node.getBoundingClientRect();
						const holderBox = holder.getBoundingClientRect();
						const wrapperStyle = getComputedStyle(wrapper);
						const holderStyle = getComputedStyle(holder);
						const px = (value: string) => parseFloat(value);
						return {
							left: box.left - holderBox.left,
							right: holderBox.right - box.right,
							declaredLeft: px(holderStyle.borderLeftWidth) + px(holderStyle.paddingLeft) + px(wrapperStyle.marginLeft),
							declaredRight: px(holderStyle.borderRightWidth) + px(holderStyle.paddingRight) + px(wrapperStyle.marginRight),
							wrapperMarginLeft: px(wrapperStyle.marginLeft)
						};
					});

				await page.goto(`${origin}/?login-failed`);
				const signInAlert = page.getByRole('main').getByRole('alert');
				await expect(signInAlert).toHaveText(en['signIn.loginFailedBanner']);
				const tokens = await resolveStyle(
					page,
					{ 'border-top-color': 'var(--fail)', 'background-color': 'var(--fail-soft)' },
					['border-top-color', 'background-color']
				);
				await expect(signInAlert).toHaveCSS('border-top-color', tokens['border-top-color']);
				await expect(signInAlert).toHaveCSS('background-color', tokens['background-color']);
				const signInShape = await shapeOf(signInAlert);
				const signInPlacement = await placement(signInAlert);

				await page.goto(`${origin}/?agents=refusal`);
				const refusal = page.getByRole('alert');
				await expect(refusal).toHaveText(en['agent.ownerAbsent']);
				const agentShape = await shapeOf(refusal);
				const agentPlacement = await placement(refusal);

				expect(signInShape).toEqual(agentShape);
				// The sign-in page lets its banner fill the card; the agent control insets its refusal by the margin it set.
				for (const { left, right, declaredLeft, declaredRight } of [signInPlacement, agentPlacement]) {
					expect(left).toBeCloseTo(declaredLeft, 1);
					expect(right).toBeCloseTo(declaredRight, 1);
				}
				expect(signInPlacement.wrapperMarginLeft).toBe(0);
				expect(agentPlacement.wrapperMarginLeft).toBeGreaterThan(0);
			});
		}

		test('names the app once in the card for screen readers', async ({ page }) => {
			await route(page);
			await page.goto(`${origin}/`);

			const snapshot = await page.getByRole('main').ariaSnapshot();
			expect(snapshot.match(/Probe/gi)).toHaveLength(1);
		});

		test('takes its display and body fonts from the family tokens', async ({ page }) => {
			await route(page);
			await page.goto(`${origin}/`);

			const card = page.getByRole('main');
			const { 'font-family': display } = await resolveStyle(
				page,
				{ 'font-family': 'var(--font-display)' },
				['font-family']
			);
			const { 'font-family': body } = await resolveStyle(page, { 'font-family': 'var(--font-body)' }, [
				'font-family'
			]);
			await expect(card.getByRole('heading')).toBeVisible();
			await expect(card.getByText('Probe').first()).toHaveCSS('font-family', display);
			await expect(card.getByRole('link')).toHaveCSS('font-family', display);
			await expect(card).toHaveCSS('font-family', body);
		});

		test('sets h1 and h2 in the display font, uppercase and spaced in proportion, from design.css alone', async ({ page }) => {
			await route(page);
			await page.goto(`${origin}/?typed`);

			const { 'font-family': display } = await resolveStyle(page, { 'font-family': 'var(--font-display)' }, [
				'font-family'
			]);
			const first = page.getByRole('heading', { level: 1 });
			const second = page.getByRole('heading', { level: 2 });
			for (const heading of [first, second]) {
				await expect(heading).toHaveCSS('font-family', display);
				await expect(heading).toHaveCSS('text-transform', 'uppercase');
				await expect(heading).not.toHaveCSS('letter-spacing', 'normal');
			}
			const trackingPerSize = (heading: Locator) =>
				heading.evaluate((node) => {
					const style = getComputedStyle(node);
					return parseFloat(style.letterSpacing) / parseFloat(style.fontSize);
				});
			expect(await trackingPerSize(second)).toBeCloseTo(await trackingPerSize(first), 3);
			await expect(first.getByText('talks', { exact: true })).toHaveCSS('letter-spacing', 'normal');
		});

		test('keeps the case of typed text in an uppercase heading', async ({ page }) => {
			await route(page);
			await page.goto(`${origin}/?typed`);

			const heading = page.getByRole('heading', { level: 1 });
			const typed = heading.getByText('talks', { exact: true });
			await expect(typed).toHaveCSS('text-transform', 'none');
			expect(await typed.innerText()).toBe('talks');
			expect(await heading.innerText()).toBe('SOURCE talks');
		});
	});
}
