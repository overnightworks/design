import { expect, test } from './coverage.ts';
import type { Page } from '@playwright/test';
import {
  consumerNames,
  consumerTitle,
  useConsumer,
} from "./build-consumer.ts";

const themes = ["light", "dark"] as const;
type Theme = (typeof themes)[number];
const deviceSchemes = themes;
const rootChoices = [undefined, ...themes] as const;
const tokens = [
  "--bg",
  "--bg-deep",
  "--surface",
  "--border",
  "--text",
  "--text-muted",
  "--ok",
  "--fail-soft",
] as const;

type Resolved = Record<string, string>;

/** The tokens and colour-scheme the element with `selector` resolves, as a surface painted from them would see. */
const resolved = (page: Page, selector: string): Promise<Resolved> =>
  page.locator(selector).evaluate((node, names) => {
    const style = getComputedStyle(node);
    return {
      ...Object.fromEntries(
        names.map((name) => [name, style.getPropertyValue(name)]),
      ),
      colorScheme: style.colorScheme,
    };
  }, tokens);

/** What a page whose root carries `theme` resolves, read without losing the root choice the page was opened with. */
async function resolvedByRootTheme(
  page: Page,
  theme: Theme,
): Promise<Resolved> {
  const chosen = await page.evaluate((forced) => {
    const previous = document.documentElement.dataset.theme;
    document.documentElement.dataset.theme = forced;
    return previous;
  }, theme);
  const rootResolved = await resolved(page, "html");
  await page.evaluate((previous) => {
    if (previous) document.documentElement.dataset.theme = previous;
    else delete document.documentElement.dataset.theme;
  }, chosen);
  return rootResolved;
}

async function openPage(
  page: Page,
  open: (page: Page, query: string) => Promise<void>,
  rootChoice: Theme | undefined,
): Promise<void> {
  await open(page, "typed");
  await page.evaluate((choice) => {
    if (choice) document.documentElement.dataset.theme = choice;
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="dark-region" data-theme="dark"><p id="dark-inner">dark</p></div>
			<div id="light-region" data-theme="light"><p id="light-inner">light</p></div>
			<div id="outer" data-theme="dark"><div id="middle" data-theme="light"><div id="innermost" data-theme="dark"><p id="deep">deep</p></div><p id="after-innermost">light</p></div></div>
			<div id="unmarked"><p>unmarked</p></div>`,
    );
  }, rootChoice);
}

for (const consumer of consumerNames) {
  test.describe(consumerTitle("a themed region", consumer), () => {
    const { open } = useConsumer(consumer, { words: false });

    for (const deviceScheme of deviceSchemes) {
      for (const rootChoice of rootChoices) {
        for (const theme of themes) {
          test(`a ${theme} region resolves as a ${theme} root, on a ${deviceScheme} device with ${rootChoice ? `a ${rootChoice} root` : "no root choice"}`, async ({
            page,
          }) => {
            await page.emulateMedia({ colorScheme: deviceScheme });
            await openPage(page, open, rootChoice);
            const region = await resolved(page, `#${theme}-region`);
            expect(region.colorScheme).toBe(theme);
            expect(await resolved(page, `#${theme}-inner`)).toEqual(region);
            const reference = await resolvedByRootTheme(page, theme);
            expect(region).toEqual(reference);
          });
        }

        test(`the nearest marked ancestor wins at any depth, on a ${deviceScheme} device with ${rootChoice ? `a ${rootChoice} root` : "no root choice"}`, async ({
          page,
        }) => {
          await page.emulateMedia({ colorScheme: deviceScheme });
          await openPage(page, open, rootChoice);
          expect(await resolved(page, "#deep")).toEqual(
            await resolvedByRootTheme(page, "dark"),
          );
          expect(await resolved(page, "#after-innermost")).toEqual(
            await resolvedByRootTheme(page, "light"),
          );
        });
      }

      test(`a root declaration of the app that comes later cannot override an explicit dark root, on a ${deviceScheme} device`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: deviceScheme });
        await openPage(page, open, "dark");
        await page.addStyleTag({ content: ":root { --bg: rgb(1, 2, 3); }" });
        expect(await resolved(page, "html")).toEqual(
          await resolved(page, "#dark-region"),
        );
      });

      test(`the page root and its unmarked content follow a ${deviceScheme} device when nobody chose`, async ({
        page,
      }) => {
        await page.emulateMedia({ colorScheme: deviceScheme });
        await openPage(page, open, undefined);
        const root = await resolved(page, "html");
        expect(root.colorScheme).toBe(deviceScheme);
        expect(await resolved(page, "#unmarked p")).toEqual(root);
        expect(root).toEqual(await resolvedByRootTheme(page, deviceScheme));
      });
    }
  });
}
