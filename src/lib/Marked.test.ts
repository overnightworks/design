import { mount } from 'svelte';
import { describe, expect, it } from 'vitest';
import Page, { sentences } from './Marked.test.svelte';
import { mountInDocument } from './mountInDocument.test.helper.ts';

async function render(parts: (typeof sentences)[number]['parts']): Promise<HTMLElement> {
	const target = await mountInDocument((into) => mount(Page, { target: into, props: { parts } }));
	return target.querySelector('p')!;
}

describe('Marked', () => {
	it.each(sentences)('reads as the sentence and puts each marked part in its snippet’s element (%#)', async ({
		parts,
		text,
		elements
	}) => {
		const sentence = await render(parts);
		expect(sentence.textContent).toBe(text);
		expect(
			[...sentence.children].map((child) => `${child.tagName.toLowerCase()}:${child.textContent}`)
		).toEqual(elements);
	});

	it('adds no wrapper element and no markup of its own around the parts', async () => {
		const sentence = await render(['Nur ', { marker: 'strong', text: 'wichtig' }]);
		const withoutAnchors = [...sentence.childNodes]
			.filter((node) => node.nodeType !== Node.COMMENT_NODE)
			.map((node) => (node instanceof Element ? node.outerHTML : node.textContent))
			.join('');
		expect(withoutAnchors).toBe('Nur <strong>wichtig</strong>');
	});
});
