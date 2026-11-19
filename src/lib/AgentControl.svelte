<script lang="ts" module>
	/** How long a row shows the outcome of a call, the same in every app. */
	export const outcomeMilliseconds = 4000;
</script>

<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import AiMark from './AiMark.svelte';
	import FailBanner from './FailBanner.svelte';
	import TurnState from './TurnState.svelte';
	import type { AgentControlOutcome, AgentControlProps, AgentControlRefusal } from './types.ts';
	import WaitingDots from './WaitingDots.svelte';
	import type { Words as KitWords } from './words/de.ts';

	const refusalKeys = {
		'not-allowed': 'agent.notAllowed',
		'owner-absent': 'agent.ownerAbsent',
		'place-full': 'agent.placeFull',
		'agent-unavailable': 'agent.agentUnavailable',
		'try-again': 'agent.tryAgain'
	} satisfies Record<AgentControlRefusal, keyof KitWords>;

	const outcomeKeys = {
		'no-answer': 'agent.noAnswer',
		busy: 'agent.busy',
		'owner-absent': 'agent.ownerAbsent'
	} satisfies Record<AgentControlOutcome, keyof KitWords>;

	let { rows, full, onCall, onSendAway, refusal, words }: AgentControlProps = $props();

	// Keys of the ended rows whose outcome has run out; a row leaves the set when the app changes it.
	const lapsed = new SvelteSet<string>();

	// Runs for each row: an ended state starts the timer, any change of it or the row's removal
	// stops the timer and takes the row out of `lapsed`. The same state passed again changes nothing.
	function outcomeTimer(_row: HTMLElement, first: { key: string; outcome: AgentControlOutcome | undefined }) {
		const { key } = first;
		let outcome: AgentControlOutcome | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		function show(next: AgentControlOutcome | undefined) {
			outcome = next;
			if (next) timer = setTimeout(() => lapsed.add(key), outcomeMilliseconds);
		}
		function stop() {
			clearTimeout(timer);
			lapsed.delete(key);
		}
		show(first.outcome);
		return {
			update(next: { outcome: AgentControlOutcome | undefined }) {
				if (next.outcome === outcome) return;
				stop();
				show(next.outcome);
			},
			destroy: stop
		};
	}
</script>

<div class="agent-control">
	{#if refusal}
		<div class="refusal"><FailBanner text={words[refusalKeys[refusal]]} /></div>
	{/if}
	{#if rows.length === 0}
		{#if !refusal}
			<p class="empty">{words[full ? 'agent.placeFull' : 'agent.empty']}</p>
		{/if}
	{:else}
		<ul>
			{#each rows as row (row.key)}
				{@const outcome = row.state === 'ended' ? row.outcome : undefined}
				<li class="agent" use:outcomeTimer={{ key: row.key, outcome }}>
					<AiMark />
					<span class="who">
						<span class="name">{row.name}</span
						>{#if row.state === 'here'}<TurnState outcome={row.turnState} {words} />{/if}
					</span>
					{#if row.state === 'available' || (row.state === 'ended' && lapsed.has(row.key))}
						<button
							class="act"
							type="button"
							aria-label={words['agent.callLabel']({ name: row.name })}
							onclick={() => onCall(row.key)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>{words['agent.call']}
						</button>
					{:else if row.state === 'ended'}
						<span class="pending" role="status">
							{#if row.outcome === 'no-answer'}
								<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
							{:else if row.outcome === 'busy'}
								<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8 12h8" /></svg>
							{:else}
								<svg viewBox="0 0 24 24" aria-hidden="true"
									><circle cx="12" cy="8" r="3.5" /><path
										d="M5 20a7 7 0 0 1 9-6.7M19 19a7 7 0 0 0-1.2-3.3M3 3l18 18"
									/></svg
								>
							{/if}{words[outcomeKeys[row.outcome]]}
						</span>
					{:else if row.state === 'inviting'}
						<span class="pending" role="status">
							<WaitingDots />{words['agent.calling']}
						</span>
					{:else if onSendAway}
						{@const sendAway = onSendAway}
						<button
							class="act"
							type="button"
							aria-label={words['agent.askToLeaveLabel']({ name: row.name })}
							onclick={() => sendAway(row.key)}
						>
							<svg viewBox="0 0 24 24" aria-hidden="true"
								><path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4M9 16l-4-4 4-4M5 12h10" /></svg
							>{words['agent.askToLeave']}
						</button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.agent-control {
		padding-bottom: 4px;
		color: var(--text);
		font-family: var(--font-body);
		font-size: 14px;
	}
	ul {
		margin: 0;
		padding: 0;
		list-style-type: none;
	}
	.agent {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 4px 10px;
		min-height: 40px;
		padding: 0 8px 0 14px;
	}
	.agent > :global(.ai-mark) {
		color: var(--text-muted);
	}
	.who {
		display: flex;
		flex: 1 1 0;
		flex-wrap: wrap;
		align-items: center;
		column-gap: 8px;
		min-width: min-content;
	}
	.name {
		flex: 1 1 auto;
		contain: inline-size;
		min-width: 5em;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.act,
	.pending {
		margin-left: auto;
	}
	.act {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 6px;
		min-height: 32px;
		padding: 0 12px 0 10px;
		border: 1px solid var(--border);
		border-radius: 999px;
		background: transparent;
		color: var(--text);
		font: inherit;
		font-size: 13px;
		font-weight: 600;
		white-space: nowrap;
		cursor: pointer;
	}
	.act svg {
		width: 15px;
		height: 15px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
		color: var(--text-muted);
	}
	.act:hover {
		background: var(--surface-hover);
	}
	.act:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}
	.pending {
		display: inline-flex;
		align-items: center;
		gap: 8px;
		padding-right: 6px;
		color: var(--text-muted);
		font-size: 13px;
		white-space: nowrap;
	}
	.pending svg {
		width: 15px;
		height: 15px;
		flex: none;
		fill: none;
		stroke: currentColor;
		stroke-width: 2;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.refusal {
		margin: 6px 14px 4px;
	}
	.empty {
		margin: 0;
		padding: 10px 14px 12px;
		color: var(--text-muted);
		font-size: 13.5px;
		line-height: 1.4;
	}
	@media (any-pointer: coarse) {
		.agent {
			min-height: 44px;
		}
		.act::after {
			content: '';
			position: absolute;
			inset: -6px -2px;
		}
	}
</style>
