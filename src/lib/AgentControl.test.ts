import { mount, tick } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AgentControl, { outcomeMilliseconds } from './AgentControl.svelte';
import { mountInDocument, unmountMounted } from './mountInDocument.test.helper.ts';
import type { AgentControlOutcome, AgentControlProps, AgentControlRefusal } from './types.ts';
import { loadWords } from './words/index.ts';

const en = await loadWords('en');
const de = await loadWords('de');

function baseProps(overrides: Partial<AgentControlProps> = {}): AgentControlProps {
	return { rows: [], onCall: () => {}, onSendAway: () => {}, words: en, ...overrides };
}

function render(overrides: Partial<AgentControlProps> = {}): Promise<HTMLElement> {
	return mountInDocument((into) => mount(AgentControl, { target: into, props: baseProps(overrides) }));
}

afterEach(() => {
	vi.useRealTimers();
});

const refusalWords: [AgentControlRefusal, keyof typeof en][] = [
	['not-allowed', 'agent.notAllowed'],
	['owner-absent', 'agent.ownerAbsent'],
	['place-full', 'agent.placeFull'],
	['agent-unavailable', 'agent.agentUnavailable'],
	['try-again', 'agent.tryAgain']
];
const rowsOf = (control: HTMLElement) => [...control.querySelectorAll('li')];
const buttonsOf = (control: HTMLElement) => [...control.querySelectorAll('button')];

describe('rows', () => {
	it('leads every row with the AI mark and shows the name as given', async () => {
		const control = await render({
			rows: [
				{ key: 'k1', name: 'mozart', state: 'available' },
				{ key: 'k2', name: 'Leonardo da Vinci', state: 'here' }
			]
		});
		const rows = rowsOf(control);
		expect(rows).toHaveLength(2);
		expect(rows.map((row) => row.firstElementChild?.textContent)).toEqual(['AI', 'AI']);
		expect(rows.map((row) => row.children[1].textContent)).toEqual(['mozart', 'Leonardo da Vinci']);
	});

	it('offers an available agent one Call button named after the agent', async () => {
		const control = await render({ rows: [{ key: 'k1', name: 'Mozart', state: 'available' }] });
		const buttons = buttonsOf(control);
		expect(buttons).toHaveLength(1);
		expect(buttons[0].textContent?.trim()).toBe(en['agent.call']);
		expect(buttons[0].getAttribute('aria-label')).toBe(en['agent.callLabel']({ name: 'Mozart' }));
		expect(buttons[0].type).toBe('button');
	});

	it('offers an agent that is here one Ask to leave button named after the agent', async () => {
		const control = await render({ rows: [{ key: 'k1', name: 'Mozart', state: 'here' }] });
		const buttons = buttonsOf(control);
		expect(buttons).toHaveLength(1);
		expect(buttons[0].textContent?.trim()).toBe(en['agent.askToLeave']);
		expect(buttons[0].getAttribute('aria-label')).toBe(en['agent.askToLeaveLabel']({ name: 'Mozart' }));
	});

	it('shows a here row without the send-away handler as the mark and the name, with no action', async () => {
		const control = await render({ rows: [{ key: 'k1', name: 'Mozart', state: 'here' }], onSendAway: undefined });
		expect(buttonsOf(control)).toHaveLength(0);
		const row = rowsOf(control)[0];
		expect(row.firstElementChild?.textContent).toBe('AI');
		expect(row.children[1].textContent).toBe('Mozart');
	});

	it('draws the stated turn outcome of a here row beside its name, and nothing extra without one', async () => {
		const control = await render({
			rows: [
				{ key: 'k1', name: 'Mozart', state: 'here', turnState: 'budget_spent' },
				{ key: 'k2', name: 'Bach', state: 'here' }
			]
		});
		const [stated, silent] = rowsOf(control);
		expect(stated.children[1].textContent?.trim()).toBe(`Mozart${en['turnState.budgetSpent']}`);
		expect(silent.children[1].textContent?.trim()).toBe('Bach');
	});

	it('shows the rows in the given order', async () => {
		const control = await render({
			rows: [
				{ key: 'b', name: 'B', state: 'here' },
				{ key: 'a', name: 'A', state: 'available' }
			]
		});
		expect(rowsOf(control).map((row) => row.children[1].textContent)).toEqual(['B', 'A']);
	});
});

describe('ended rows', () => {
	const ended = (outcome: AgentControlOutcome): AgentControlProps['rows'][number] => ({
		key: 'k1',
		name: 'Mozart',
		state: 'ended',
		outcome
	});
	const statusOf = (control: HTMLElement) => control.querySelector('[role="status"]');

	async function renderWithTimers(overrides: Partial<AgentControlProps>) {
		vi.useFakeTimers();
		return render(overrides);
	}

	async function renderChangingRows(initial: AgentControlProps['rows']) {
		vi.useFakeTimers();
		const state = new SvelteMap([['rows', initial]]);
		const props = {
			...baseProps(),
			get rows() {
				return state.get('rows')!;
			}
		};
		const target = await mountInDocument((into) => mount(AgentControl, { target: into, props }));
		return {
			control: target,
			setRows: async (rows: AgentControlProps['rows']) => {
				state.set('rows', rows);
				await tick();
			}
		};
	}

	it.each(['no-answer', 'busy', 'owner-absent'] as const)('hides the icon of the %s outcome from assistive technology', async (outcome) => {
		const control = await render({ rows: [ended(outcome)] });
		expect(statusOf(control)?.querySelectorAll('svg[aria-hidden="true"]')).toHaveLength(1);
	});

	it('keeps the row callable until the app changes it', async () => {
		const control = await renderWithTimers({ rows: [ended('no-answer')] });
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds * 5);
		expect(buttonsOf(control)).toHaveLength(1);
		expect(statusOf(control)).toBeNull();
	});

	it('restarts the duration when the app passes a new ended state for the row', async () => {
		const { control, setRows } = await renderChangingRows([ended('no-answer')]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds - 1);
		await setRows([{ key: 'k1', name: 'Mozart', state: 'inviting' }]);
		await setRows([ended('busy')]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds - 1);
		expect(statusOf(control)?.textContent?.trim()).toBe(en['agent.busy']);
		await vi.advanceTimersByTimeAsync(1);
		expect(statusOf(control)).toBeNull();
	});

	it('restarts the duration when the outcome of an ended row changes', async () => {
		const { control, setRows } = await renderChangingRows([ended('no-answer')]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds - 1);
		await setRows([ended('busy')]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds - 1);
		expect(statusOf(control)?.textContent?.trim()).toBe(en['agent.busy']);
	});

	it('shows the outcome again when the app ends the call anew after the row lapsed', async () => {
		const { control, setRows } = await renderChangingRows([ended('no-answer')]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds);
		expect(statusOf(control)).toBeNull();
		await setRows([{ key: 'k1', name: 'Mozart', state: 'inviting' }]);
		await setRows([ended('no-answer')]);
		expect(statusOf(control)?.textContent?.trim()).toBe(en['agent.noAnswer']);
	});

	it('leaves other rows and their timers untouched', async () => {
		const { control, setRows } = await renderChangingRows([
			ended('no-answer'),
			{ key: 'k2', name: 'Bach', state: 'inviting' }
		]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds - 1);
		await setRows([ended('no-answer'), { key: 'k2', name: 'Bach', state: 'here' }]);
		await vi.advanceTimersByTimeAsync(1);
		expect(rowsOf(control).map((row) => row.lastElementChild?.textContent?.trim())).toEqual([
			en['agent.call'],
			en['agent.askToLeave']
		]);
	});

	it('does not restart the duration when the app passes the same ended row again', async () => {
		const { control, setRows } = await renderChangingRows([ended('busy')]);
		await vi.advanceTimersByTimeAsync(outcomeMilliseconds - 1);
		await setRows([ended('busy')]);
		await vi.advanceTimersByTimeAsync(1);
		expect(statusOf(control)).toBeNull();
	});

	it('clears its timer when the row changes or the control unmounts', async () => {
		const { setRows } = await renderChangingRows([ended('busy')]);
		expect(vi.getTimerCount()).toBe(1);
		await setRows([{ key: 'k1', name: 'Mozart', state: 'here' }]);
		expect(vi.getTimerCount()).toBe(0);
		await setRows([ended('busy')]);
		expect(vi.getTimerCount()).toBe(1);
		await unmountMounted();
		expect(vi.getTimerCount()).toBe(0);
	});
});

describe('refusal', () => {
	const rows: AgentControlProps['rows'] = [{ key: 'k1', name: 'Mozart', state: 'available' }];

	it('draws no alert while no refusal is set', async () => {
		const control = await render({ rows });
		expect(control.querySelector('[role="alert"]')).toBeNull();
	});

	it.each(refusalWords)('draws the %s sentence as an alert above the rows', async (refusal, key) => {
		const control = await render({ rows, refusal });
		const alert = control.querySelector('[role="alert"]')!;
		expect(alert.textContent?.trim()).toBe(en[key]);
		const list = control.querySelector('ul')!;
		expect(alert.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
	});
});

describe('empty face', () => {
	it('draws no empty sentence while rows exist', async () => {
		const control = await render({ rows: [{ key: 'k1', name: 'Mozart', state: 'here' }] });
		expect(control.textContent).not.toContain(en['agent.empty']);
	});
});

describe('words', () => {
	it('draws every word of the de words: the ruled list, the names and none of the en words', async () => {
		const control = await render({
			rows: [
				{ key: 'k1', name: 'Mozart', state: 'available' },
				{ key: 'k2', name: 'Bach', state: 'inviting' },
				{ key: 'k3', name: 'Leonardo', state: 'here' }
			],
			words: de
		});
		expect(rowsOf(control).map((row) => row.lastElementChild?.textContent?.trim())).toEqual([
			de['agent.call'],
			de['agent.calling'],
			de['agent.askToLeave']
		]);
		expect(buttonsOf(control).map((button) => button.getAttribute('aria-label'))).toEqual([
			de['agent.callLabel']({ name: 'Mozart' }),
			de['agent.askToLeaveLabel']({ name: 'Leonardo' })
		]);
		for (const key of ['agent.call', 'agent.calling', 'agent.askToLeave'] as const)
			expect(control.textContent).not.toContain(en[key]);
	});
});
