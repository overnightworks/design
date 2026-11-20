import { mount } from 'svelte';
import { expect, it } from 'vitest';
import TurnState from './TurnState.svelte';
import { mountInDocument } from './mountInDocument.test.helper.ts';
import { loadWords } from './words/index.ts';

it('is a standing state with no role and no live region', async () => {
	const words = await loadWords('en');
	const target = await mountInDocument((into) => mount(TurnState, { target: into, props: { outcome: 'busy', words } }));
	const part = target.firstElementChild as HTMLElement;
	expect(part.hasAttribute('role')).toBe(false);
	expect(part.hasAttribute('aria-live')).toBe(false);
});
