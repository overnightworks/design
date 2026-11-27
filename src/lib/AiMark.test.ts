import { mount } from 'svelte';
import { describe, expect, it } from 'vitest';
import AiMark from './AiMark.svelte';
import { mountInDocument } from '../support/mountInDocument.ts';

async function render(props: Record<string, string> = {}, place?: HTMLElement): Promise<HTMLElement> {
	return mountInDocument((into) => mount(AiMark, { target: into, props }), place);
}

describe('AiMark', () => {
	it.each<Record<string, string>>([{}, { text: 'Agent', label: 'KI' }])(
		'renders the text AI and nothing else, whatever props a caller passes (%o)',
		async (props) => {
			const page = await render(props);
			expect(page.textContent).toBe('AI');
		},
	);

	it('leaves its text visible to assistive technology', async () => {
		const page = await render();
		expect(page.querySelector('[aria-hidden]')).toBeNull();
	});

	it('outlines itself in the colour of its place', async () => {
		const place = document.createElement('div');
		place.style.color = 'rgb(10, 20, 30)';
		document.body.append(place);
		const page = await render({}, place);
		const mark = page.querySelector('span')!;
		expect(getComputedStyle(mark).borderTopColor).toBe('rgb(10, 20, 30)');
	});
});
