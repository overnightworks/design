import { mount, tick, unmount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { describe, expect, it, vi } from 'vitest';
import AccountMenu from './AccountMenu.svelte';
import { mountInDocument } from '../support/mountInDocument.ts';
import type { AccountMenuProps } from './types.ts';
import { loadWords } from './words/index.ts';

const en = await loadWords('en');
const de = await loadWords('de');

function baseProps(overrides: Partial<AccountMenuProps> = {}): AccountMenuProps {
	return {
		name: 'Felix',
		accountHref: 'https://account.example/me',
		onAccountOpen: () => {},
		appRows: [],
		legalLinks: [],
		onLogOut: () => {},
		words: en,
		...overrides
	} as AccountMenuProps;
}

function render(overrides: Partial<AccountMenuProps> = {}): Promise<HTMLElement> {
	return mountInDocument((into) => mount(AccountMenu, { target: into, props: baseProps(overrides) }));
}

function radios(menu: HTMLElement): HTMLInputElement[] {
	return [...menu.querySelectorAll<HTMLInputElement>('input[type="radio"]')];
}

function buttonNamed(menu: HTMLElement, name: string): HTMLButtonElement | undefined {
	return [...menu.querySelectorAll('button')].find((button) => button.textContent?.trim() === name);
}

function checkedLabel(menu: HTMLElement): string | undefined {
	return radios(menu).find((radio) => radio.checked)?.closest('label')?.textContent?.trim();
}

describe('name row', () => {
	it('links the name to the account in a new tab and hides the icon', async () => {
		const menu = await render();
		const link = menu.querySelector<HTMLAnchorElement>('a[href="https://account.example/me"]')!;
		expect(link.textContent?.trim()).toBe('Felix');
		expect(link.getAttribute('target')).toBe('_blank');
		expect(link.getAttribute('rel')).toBe('noopener noreferrer');
		expect(link.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
	});
});

describe('app rows', () => {
	it('renders each row as a button in order above Theme', async () => {
		const menu = await render({
			appRows: [
				{ label: 'Settings', onSelect: () => {} },
				{ label: 'Other', onSelect: () => {} }
			],
			theme: { choice: 'light', onChange: () => {} }
		});
		const rows = [...menu.querySelectorAll<HTMLButtonElement>('button[type="button"]')].filter(
			(button) => button.textContent?.trim() !== en['account.logOut']
		);
		expect(rows.map((row) => row.textContent?.trim())).toEqual(['Settings', 'Other']);
		const theme = [...menu.querySelectorAll('*')].find((node) => node.textContent?.trim() === en['account.theme'])!;
		expect(rows[1].compareDocumentPosition(theme) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});

	it('renders no app row for an empty list', async () => {
		const menu = await render({ appRows: [] });
		expect([...menu.querySelectorAll('button')].map((button) => button.textContent?.trim())).toEqual([
			en['account.logOut']
		]);
	});
});

describe('theme rows', () => {
	it('survives an app update that unmounts the menu while reporting a pick', async () => {
		const target = document.createElement('div');
		document.body.append(target);
		const component = mount(AccountMenu, {
			target,
			props: baseProps({
				theme: {
					choice: 'light',
					onChange: () => {
						void unmount(component);
					}
				}
			})
		});
		await tick();
		const errors: unknown[] = [];
		const record = (event: ErrorEvent) => errors.push(event.error);
		window.addEventListener('error', record);
		radios(target)[2].click();
		window.removeEventListener('error', record);
		expect(errors).toEqual([]);
		target.remove();
	});

	it('keeps two mounted menus in separate radio groups', async () => {
		const first = await render({ theme: { choice: 'light', onChange: () => {} } });
		const second = await render({ theme: { choice: 'dark', onChange: () => {} } });
		const names = new Set([...radios(first), ...radios(second)].map((radio) => radio.name));
		expect(names.size).toBe(2);
		expect(checkedLabel(first)).toBe(en['account.light']);
		expect(checkedLabel(second)).toBe(en['account.dark']);
	});
});

describe('log out', () => {
	it('is a type=button and shows no alert without a failure', async () => {
		const menu = await render();
		const button = [...menu.querySelectorAll('button')].find((candidate) =>
			candidate.textContent?.includes(en['account.logOut'])
		)!;
		expect(button.type).toBe('button');
		expect(menu.querySelector('[role="alert"]')).toBeNull();
		expect(menu.querySelector('form')).toBeNull();
	});

	it('shows the failure as an alert after the button', async () => {
		const menu = await render({ onLogOut: () => {}, logOutFailure: 'Logging out failed.' });
		const alert = menu.querySelector('[role="alert"]')!;
		expect(alert.textContent).toContain('Logging out failed.');
		const button = [...menu.querySelectorAll('button')].find((candidate) =>
			candidate.textContent?.includes(en['account.logOut'])
		)!;
		expect(button.compareDocumentPosition(alert) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

describe('legal row', () => {
	it('renders no legal row for an empty list', async () => {
		const menu = await render({ legalLinks: [] });
		expect(menu.querySelector('nav')).toBeNull();
	});
});

describe('words from the app', () => {
	const shownWords = (words: typeof en): string[] => [
		words['account.theme'],
		words['account.followSystem'],
		words['account.light'],
		words['account.dark'],
		words['account.logOut']
	];

	it.each([
		['a callback', { onLogOut: () => {} }],
		['a form action', { logOutAction: '/logout' }]
	] as const)('shows the given words and no en word with %s to log out', async (_form, logOut) => {
		const menu = await render({ words: de, theme: { choice: 'dark', onChange: () => {} }, ...logOut });
		const group = menu.querySelector('[role="radiogroup"]')!;
		const label = document.getElementById(group.getAttribute('aria-labelledby')!);
		expect(label?.textContent?.trim()).toBe(de['account.theme']);
		expect([...group.querySelectorAll('label')].map((row) => row.textContent?.trim())).toEqual([
			de['account.followSystem'],
			de['account.light'],
			de['account.dark']
		]);
		expect(checkedLabel(menu)).toBe(de['account.dark']);
		expect(buttonNamed(menu, de['account.logOut'])).toBeDefined();
		for (const word of shownWords(en)) expect(menu.textContent).not.toContain(word);
	});

	it('shows words given after the mount instead of the ones it first showed', async () => {
		const state = new SvelteMap<string, typeof en>([['words', en]]);
		const onChange = vi.fn();
		const props = {
			...baseProps({ theme: { choice: 'dark', onChange } }),
			get words() {
				return state.get('words')!;
			}
		};
		const target = await mountInDocument((into) => mount(AccountMenu, { target: into, props }));
		expect(checkedLabel(target)).toBe(en['account.dark']);
		state.set('words', de);
		await tick();
		const group = target.querySelector('[role="radiogroup"]')!;
		const label = document.getElementById(group.getAttribute('aria-labelledby')!);
		expect(label?.textContent?.trim()).toBe(de['account.theme']);
		expect([...group.querySelectorAll('label')].map((row) => row.textContent?.trim())).toEqual([
			de['account.followSystem'],
			de['account.light'],
			de['account.dark']
		]);
		expect(checkedLabel(target)).toBe(de['account.dark']);
		expect(onChange).not.toHaveBeenCalled();
	});
});
