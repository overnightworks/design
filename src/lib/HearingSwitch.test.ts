import { mount } from 'svelte';
import { describe, expect, it } from 'vitest';
import HearingSwitch from './HearingSwitch.svelte';
import { mountInDocument } from '../support/mountInDocument.ts';
import type { HearingKind, HearingSwitchProps } from './types.ts';
import { loadWords } from './words/index.ts';

const en = await loadWords('en');
const de = await loadWords('de');

const nameKeys = {
	hear: 'hearing.agentMayHearMe',
	listen: 'hearing.iWantToHearAgent',
	see: 'hearing.agentMaySeeMe'
} as const satisfies Record<HearingKind, keyof typeof en>;

const kinds: HearingKind[] = ['hear', 'listen', 'see'];

/** The visible label is the name for hear and listen, the short word for see. */
const visibleKeys = { ...nameKeys, see: 'hearing.seeShort' } as const;

function baseProps(overrides: Partial<HearingSwitchProps> = {}): HearingSwitchProps {
	return { kind: 'hear', on: true, onChange: () => {}, words: en, ...overrides };
}

async function render(overrides: Partial<HearingSwitchProps> = {}): Promise<HTMLButtonElement> {
	const target = await mountInDocument((into) => mount(HearingSwitch, { target: into, props: baseProps(overrides) }));
	return target.querySelector('button')!;
}

describe('the chip', () => {
	it.each<[HearingKind, boolean]>([
		['hear', true],
		['hear', false],
		['listen', true],
		['listen', false],
		['see', true],
		['see', false]
	])('is one switch button that shows %s as on=%s in aria-checked', async (kind, on) => {
		const chip = await render({ kind, on });
		expect(chip.parentElement?.querySelectorAll('button')).toHaveLength(1);
		expect(chip.type).toBe('button');
		expect(chip.getAttribute('role')).toBe('switch');
		expect(chip.getAttribute('aria-checked')).toBe(String(on));
	});

	it.each<[HearingKind]>([['hear'], ['listen']])('names the %s chip by its visible label', async (kind) => {
		const chip = await render({ kind });
		expect(chip.textContent?.trim()).toBe(en[nameKeys[kind]]);
		expect(chip.hasAttribute('aria-label')).toBe(false);
		expect(chip.hasAttribute('aria-labelledby')).toBe(false);
	});

	it('hides the icons and the track from assistive technology', async () => {
		const chip = await render();
		for (const svg of chip.querySelectorAll('svg')) expect(svg.getAttribute('aria-hidden')).toBe('true');
		const tracks = chip.querySelectorAll('span[aria-hidden="true"]');
		expect(tracks).toHaveLength(1);
		expect(tracks[0].textContent).toBe('');
		expect(chip.textContent?.trim()).toBe(en[nameKeys.hear]);
	});

	it.each(kinds)('draws the %s icon differently when off', async (kind) => {
		const on = await render({ kind, on: true });
		const off = await render({ kind, on: false });
		expect(on.querySelector('svg')).not.toBeNull();
		expect(on.querySelector('svg')!.innerHTML).not.toBe(off.querySelector('svg')!.innerHTML);
	});
});

describe('compact', () => {
	it.each(kinds)('keeps the %s chip a named switch with its label in the document', async (kind) => {
		const chip = await render({ kind, compact: true });
		expect(chip.getAttribute('role')).toBe('switch');
		expect(chip.textContent?.trim()).toBe(en[visibleKeys[kind]]);
		expect(chip.getAttribute('aria-label') ?? chip.textContent?.trim()).toBe(en[nameKeys[kind]]);
	});

	it.each(kinds)('marks only the compact %s chip', async (kind) => {
		const compact = await render({ kind, compact: true });
		const regular = await render({ kind });
		expect(compact.classList.contains('compact')).toBe(true);
		expect(regular.classList.contains('compact')).toBe(false);
	});
});

describe('words', () => {
	it.each(kinds)('names the %s chip with the de words', async (kind) => {
		const chip = await render({ kind, words: de });
		expect(chip.getAttribute('aria-label') ?? chip.textContent?.trim()).toBe(de[nameKeys[kind]]);
	});
});
