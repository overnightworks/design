import { createRawSnippet } from 'svelte';
import { render } from 'svelte/server';
import { describe, expect, it } from 'vitest';
import HelperChat from './HelperChat.svelte';
import type { HelperChatProps, HelperMessage } from './types.ts';
import { loadWords, type Language } from './words/index.ts';

const languages: Language[] = ['en', 'de'];

const serverProps = async (language: Language, overrides: Partial<HelperChatProps<HelperMessage>> = {}): Promise<HelperChatProps<HelperMessage>> => ({
	messages: [],
	running: false,
	history: { state: 'ready' },
	helperName: 'Mozart',
	emptyHint: 'Ask me anything',
	placeholder: '',
	draft: '',
	onDraft: () => {},
	onSend: () => {},
	words: await loadWords(language),
	...overrides
});

describe.each(languages)('HelperChat server-rendered in the %s words', (language) => {
	it('renders the messages, the composer and the kit words without a script', async () => {
		const props = await serverProps(language, {
			messages: [
				{ role: 'user', text: 'Rewrite it' },
				{ role: 'assistant', text: 'Done', toolCalls: [{ name: 'rewrite', input: {} }] }
			],
			placeholder: 'Ask for a rewrite…',
			draft: 'A draft'
		});
		const { words } = props;
		const { body } = render(HelperChat, { props });
		expect(body).toContain('Rewrite it');
		expect(body).toContain('Done');
		expect(body).toContain(words['helperChat.ranTool']({ tool: 'rewrite' }));
		expect(body).toContain(words['helperChat.send']);
		expect(body).toContain(words['helperChat.composerLabel']({ name: 'Mozart' }));
		expect(body).toContain(`aria-label="${words['helperChat.listLabel']({ name: 'Mozart' })}"`);
		expect(body).toMatch(/<ol\b[^>]*role="list"/);
		expect(body).toContain(words['helperChat.speaker']({ name: words['helperChat.you'] }));
		expect(body).toContain(words['helperChat.speaker']({ name: 'Mozart' }));
		expect(body).toMatch(/<textarea\b[^>]*>/);
		expect(body).toMatch(/role="status"/);
		expect(body).not.toMatch(/<script\b/);
	});

	it('renders the loading word and no list while the history loads', async () => {
		const props = await serverProps(language, { history: { state: 'loading' } });
		const { body } = render(HelperChat, { props });
		expect(body).toContain(props.words['helperChat.loading']);
		expect(body).not.toContain('Ask me anything');
	});
});

it('renders the closed pick list hidden and the field with the static autocompletion attributes', async () => {
	const props = await serverProps('en', {
		composerPick: {
			label: 'People',
			open: false,
			keys: ['anna'],
			active: 'anna',
			option: createRawSnippet(() => ({ render: () => '<span>Anna</span>' })),
			empty: 'No one matches',
			onPick: () => {},
			onDismiss: () => {}
		}
	});
	const { body } = render(HelperChat, { props });
	const listbox = /<div\b(?=[^>]*role="listbox")[^>]*>/.exec(body)![0];
	expect(listbox).toMatch(/\shidden\b/);
	expect(listbox).toContain('aria-label="People"');
	const listId = /\sid="([^"]+)"/.exec(listbox)![1];
	const field = /<textarea\b[^>]*>/.exec(body)![0];
	expect(field).toContain('aria-autocomplete="list"');
	expect(field).toContain('aria-haspopup="listbox"');
	expect(field).toContain(`aria-controls="${listId}"`);
	expect(field).not.toContain('aria-activedescendant');
});
