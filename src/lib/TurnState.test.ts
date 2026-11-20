import { mount } from 'svelte';
import { describe, expect, it } from 'vitest';
import TurnState from './TurnState.svelte';
import { mountInDocument } from './mountInDocument.test.helper.ts';
import type { TurnOutcome } from './types.ts';
import { loadWords, type Language } from './words/index.ts';

async function render(outcome: TurnOutcome | undefined, language: Language = 'en'): Promise<HTMLElement> {
	const words = await loadWords(language);
	return mountInDocument((into) => mount(TurnState, { target: into, props: { outcome, words } }));
}

describe('TurnState', () => {
	it('renders nothing, not even a wrapper, without an outcome', async () => {
		const target = await render(undefined);
		expect(target.childElementCount).toBe(0);
		expect(target.textContent).toBe('');
	});

	it('is a standing state with no role and no live region', async () => {
		const part = (await render('busy')).firstElementChild as HTMLElement;
		expect(part.hasAttribute('role')).toBe(false);
		expect(part.hasAttribute('aria-live')).toBe(false);
	});
});
