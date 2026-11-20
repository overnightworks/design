import { createRawSnippet, mount, tick } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { describe, expect, it, vi } from 'vitest';
import HelperChat from './HelperChat.svelte';
import { mountInDocument } from './mountInDocument.test.helper.ts';
import type { HelperChatProps, HelperMessage } from './types.ts';
import { loadWords } from './words/index.ts';

const en = await loadWords('en');
const de = await loadWords('de');

const text = (content: string) => createRawSnippet(() => ({ render: () => `<span>${content}</span>` }));
const button = (content: string) => createRawSnippet(() => ({ render: () => `<button type="button">${content}</button>` }));

function baseProps(overrides: Partial<HelperChatProps<HelperMessage>> = {}): HelperChatProps<HelperMessage> {
	return {
		messages: [],
		running: false,
		history: { state: 'ready' },
		helperName: 'Mozart',
		emptyHint: 'Ask me anything',
		placeholder: 'Ask for a rewrite…',
		draft: '',
		onDraft: () => {},
		onSend: () => {},
		words: en,
		...overrides
	};
}

function render(overrides: Partial<HelperChatProps<HelperMessage>> = {}): Promise<HTMLElement> {
	return mountInDocument((into) => mount(HelperChat, { target: into, props: baseProps(overrides) }));
}

const field = (root: HTMLElement) => root.querySelector('textarea')!;
const buttonWorded = (root: HTMLElement, word: string) =>
	[...root.querySelectorAll('button')].find((candidate) => candidate.textContent?.trim() === word)!;
const sendButton = (root: HTMLElement, words: typeof en = en) => buttonWorded(root, words['helperChat.send']);
const status = (root: HTMLElement) => root.querySelector('[role="status"]');
const visibleLine = (root: HTMLElement) => root.querySelector('ol [aria-hidden="true"]');

// AiMark.svelte holds the word as a constant for every language, so no catalog key exists (gap named on #276).
const aiMarkWord = 'AI';

// The bubble, the AI mark and the tool row have no role (gaps named on #276): the bubble is the item's content after its speaker, the mark the element worded with the AI mark word, the tool row the parent of the kit's tool word.
const bubbleOf = (item: Element) => (item.lastElementChild === item.firstElementChild ? null : item.lastElementChild);
const bubbles = (root: HTMLElement) => [...root.querySelectorAll('li')].map(bubbleOf).filter((bubble) => bubble !== null);
const aiMarks = (scope: Element) => [...scope.querySelectorAll('span')].filter((candidate) => candidate.textContent === aiMarkWord && candidate.children.length === 0);
const toolRow = (root: HTMLElement, tool: string) =>
	[...root.querySelectorAll('span')].find((candidate) => candidate.textContent === en['helperChat.ranTool']({ tool }))!.parentElement!;

function press(target: HTMLElement, init: KeyboardEventInit): KeyboardEvent {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init });
	target.dispatchEvent(event);
	return event;
}

describe('the message list', () => {
	it('shows the empty hint while there is no message and no hint once there is one', async () => {
		const empty = await render();
		expect(empty.textContent).toContain('Ask me anything');
		const filled = await render({ messages: [{ role: 'user', text: 'Hello' }] });
		expect(filled.textContent).not.toContain('Ask me anything');
	});

	it('names the message list with the kit word and the helper’s name and makes each message one of its items', async () => {
		const root = await render({ messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: 'Hello' }], words: de });
		const lists = root.querySelectorAll('[role="list"]');
		expect(lists).toHaveLength(1);
		expect(lists[0].getAttribute('aria-label')).toBe(de['helperChat.listLabel']({ name: 'Mozart' }));
		expect([...lists[0].children].map((item) => item.tagName)).toEqual(['LI', 'LI']);
		expect(lists[0].closest('[aria-live]')).toBeNull();
	});

	it('shows only the empty hint, no list, while there is no message', async () => {
		const root = await render();
		expect(root.querySelector('[role="list"], ol, li')).toBeNull();
		expect(root.textContent).toContain('Ask me anything');
	});

	it('shows no bubble for a helper message with neither text nor tool calls', async () => {
		const root = await render({ messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: '' }] });
		expect(bubbles(root)).toHaveLength(1);
	});

	it('gives a tool row no title without a title function and no target without a target snippet', async () => {
		const root = await render({
			messages: [{ role: 'assistant', text: 'Done', toolCalls: [{ name: 'rewrite', input: {} }] }]
		});
		const row = toolRow(root, 'rewrite');
		expect(row.hasAttribute('title')).toBe(false);
		expect(row.children).toHaveLength(1);
	});

	it('shows the app’s problem line after the message it belongs to, called with that message and index', async () => {
		const root = await render({
			messages: [
				{ role: 'user', text: 'Hi' },
				{ role: 'assistant', text: 'Oops' }
			],
			problemLine: createRawSnippet((parameters) => ({
				render: () => `<p class="problem">${parameters().message.role}@${parameters().index}</p>`
			}))
		});
		const messages = [...root.querySelectorAll('li')];
		expect(messages.map((message) => message.querySelector('.problem')?.textContent)).toEqual(['user@0', 'assistant@1']);
	});

	it('hands the app’s own message type to its snippets', async () => {
		type AppMessage = HelperMessage & { readonly id: string };
		const props: HelperChatProps<AppMessage> = {
			...baseProps(),
			messages: [{ role: 'assistant', text: 'Hi', id: 'm-7' }],
			problemLine: createRawSnippet((parameters) => ({ render: () => `<p class="problem">${parameters().message.id}</p>` }))
		};
		const target = await mountInDocument((into) => mount(HelperChat<AppMessage>, { target: into, props }));
		expect(target.querySelector('.problem')?.textContent).toBe('m-7');
	});
});

describe('the history', () => {
	it('shows the failure as an alert instead of the list when it failed', async () => {
		const root = await render({ history: { state: 'failed', failure: 'Chat is gone' }, messages: [{ role: 'user', text: 'Hi' }] });
		expect(root.querySelector('[role="alert"]')?.textContent).toBe('Chat is gone');
		expect(root.querySelector('ol')).toBeNull();
		expect(root.textContent).not.toContain('Hi');
	});
});

describe('the thinking line', () => {
	it.each([
		['the last message is the person’s', [{ role: 'user', text: 'Hi' }] as HelperMessage[], true],
		['the last helper message already has text', [{ role: 'assistant', text: 'Here' }] as HelperMessage[], true],
		['no turn runs', [{ role: 'assistant', text: '' }] as HelperMessage[], false]
	])('is empty when %s', async (_case, messages, running) => {
		const root = await render({ messages, running });
		expect(status(root)?.textContent).toBe('');
	});

	it('shows the visible thinking line, hidden from assistive technology, after the tool rows in the last helper bubble', async () => {
		const root = await render({
			messages: [{ role: 'assistant', text: '', toolCalls: [{ name: 'rewrite', input: {} }] }],
			running: true
		});
		const row = toolRow(root, 'rewrite');
		const visible = visibleLine(root)!;
		expect(bubbles(root)[0].contains(visible)).toBe(true);
		expect(visible.getAttribute('aria-hidden')).toBe('true');
		expect(visible.textContent).toBe(en['helperChat.thinking']({ name: 'Mozart' }));
		expect(row.compareDocumentPosition(visible)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
	});

	it('gives the pending helper message one AiMark and its bubble the visible thinking line while it has neither text nor tool calls', async () => {
		const root = await render({ messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: '' }], running: true });
		const shown = bubbles(root);
		expect(shown).toHaveLength(2);
		expect(aiMarks(shown[1])).toHaveLength(1);
		expect(shown[1].contains(visibleLine(root))).toBe(true);
	});

	it('keeps the status element out of the list, as a direct child of the part’s root', async () => {
		const root = await render({ messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: '' }], running: true });
		expect(status(root)!.parentElement).toBe(root.firstElementChild);
	});

	it.each([
		['starts', false, true],
		['stops', true, false]
	])('keeps the one status element and shows the visible line only while thinking when a turn %s on an unchanged empty helper message', async (_case, before, after) => {
		const held = new SvelteMap<string, boolean>([['running', before]]);
		const props = Object.defineProperties(baseProps({ messages: [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: '' }] }), {
			running: { enumerable: true, get: () => held.get('running')! }
		});
		const target = await mountInDocument((into) => mount(HelperChat, { target: into, props }));
		const line = status(target)!;
		expect(visibleLine(target) !== null).toBe(before);

		held.set('running', after);
		await tick();
		expect(status(target)).toBe(line);
		expect(target.querySelectorAll('[role="status"]')).toHaveLength(1);
		expect(visibleLine(target) !== null).toBe(after);
		expect(line.textContent === '').toBe(!after);
	});

	it('keeps the one status element while the history changes, with its text empty unless the list shows, and while the list is replaced', async () => {
		const held = new SvelteMap<string, unknown>([
			['history', { state: 'ready' }],
			['messages', [{ role: 'user', text: 'Hi' }, { role: 'assistant', text: '' }]]
		]);
		const props = Object.defineProperties(baseProps({ running: true }), {
			history: { enumerable: true, get: () => held.get('history') as HelperChatProps<HelperMessage>['history'] },
			messages: { enumerable: true, get: () => held.get('messages') as HelperMessage[] }
		});
		const target = await mountInDocument((into) => mount(HelperChat, { target: into, props }));
		const line = status(target)!;
		expect(line.textContent).toBe(en['helperChat.thinking']({ name: 'Mozart' }));

		for (const state of [{ state: 'loading' }, { state: 'failed', failure: 'Gone' }, { state: 'ready' }]) {
			held.set('history', state);
			await tick();
			expect(status(target)).toBe(line);
			expect(target.querySelectorAll('[role="status"]')).toHaveLength(1);
			expect(line.textContent === '').toBe(state.state !== 'ready');
			expect(visibleLine(target) !== null).toBe(state.state === 'ready');
		}

		held.set('messages', [{ role: 'user', text: 'Earlier' }, { role: 'assistant', text: 'Answer' }, { role: 'user', text: 'Hi' }, { role: 'assistant', text: '' }]);
		await tick();
		expect(status(target)).toBe(line);
		expect(line.textContent).toBe(en['helperChat.thinking']({ name: 'Mozart' }));
		expect(bubbles(target)[3].contains(visibleLine(target))).toBe(true);
	});
});

describe('the composer', () => {
	it('names the field by the kit word with the helper’s name and shows the app’s placeholder', async () => {
		const root = await render();
		expect(field(root).getAttribute('aria-label')).toBe(en['helperChat.composerLabel']({ name: 'Mozart' }));
		expect(field(root).placeholder).toBe('Ask for a rewrite…');
	});

	it('puts the bar of tags between the banner and the composer box', async () => {
		const root = await render({ composerTop: text('Tag bar'), readOnly: text('Archived') });
		const box = field(root).parentElement!;
		const order = [...box.parentElement!.children].map((child) => (child === box ? 'box' : child.textContent));
		expect(order).toEqual(['Archived', 'Tag bar', 'box']);
	});

	it('keeps focus in the composer when a button inside its box is pressed', async () => {
		const root = await render({ composerPopup: button('Pick') });
		const own = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		sendButton(root).dispatchEvent(own);
		const app = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		buttonWorded(root, 'Pick').dispatchEvent(app);
		const inField = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
		field(root).dispatchEvent(inField);
		expect([own.defaultPrevented, app.defaultPrevented, inField.defaultPrevented]).toEqual([true, true, false]);
	});
});

describe('sending', () => {
	it.each<[string, Partial<HelperChatProps<HelperMessage>>]>([
		['a turn runs', { draft: 'Hello', running: true }],
		['the draft is empty', { draft: '' }],
		['the draft is only white space', { draft: ' \n ' }],
		['the chat is read-only', { draft: 'Hello', readOnly: text('Archived') }]
	])('sends nothing and still cancels a plain Enter when %s', async (_case, overrides) => {
		const onSend = vi.fn();
		const root = await render({ onSend, ...overrides });
		const event = press(field(root), { key: 'Enter' });
		expect(onSend).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});

	it('sends nothing and still cancels a plain Enter while an IME composes', async () => {
		const onSend = vi.fn();
		const root = await render({ draft: 'こんにち', onSend });
		const event = press(field(root), { key: 'Enter', isComposing: true });
		expect(onSend).not.toHaveBeenCalled();
		expect(event.defaultPrevented).toBe(true);
	});
});

describe('read-only', () => {
	it('shows no banner and enables the field without the snippet', async () => {
		const root = await render();
		expect(field(root).parentElement!.parentElement!.textContent?.trim()).toBe(en['helperChat.send']);
		expect(field(root).disabled).toBe(false);
	});
});
