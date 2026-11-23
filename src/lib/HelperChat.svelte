<script lang="ts" generics="Message extends HelperMessage">
	import AiMark from './AiMark.svelte';
	import type { HelperChatProps, HelperMessage } from './types.ts';

	let {
		messages,
		running,
		history,
		helperName,
		emptyHint,
		placeholder,
		draft,
		onDraft,
		onSend,
		onComposerKeydown,
		readOnly,
		problemLine,
		toolCallTarget,
		toolCallTitle,
		composerPick,
		composerTop,
		list = $bindable(),
		onListScroll,
		words
	}: HelperChatProps<Message> = $props();

	const id = $props.id();
	const listId = `${id}-pick`;
	const optionId = (key: string): string => `${id}-pick-${encodeURIComponent(key)}`;

	let composerBox: HTMLDivElement | undefined = $state();
	let field: HTMLTextAreaElement | undefined = $state();
	let pickList: HTMLDivElement | undefined = $state();

	const lastMessage = $derived(messages.at(-1));
	const historyReady = $derived(history.state === 'ready');
	const thinking = $derived(
		historyReady && running && lastMessage?.role === 'assistant' && lastMessage.text === ''
	);
	const thinkingWord = $derived(words['helperChat.thinking']({ name: helperName }));
	const sendable = $derived(!running && readOnly === undefined && draft.trim() !== '');

	// A read-only field is disabled and offers no list.
	const pick = $derived(readOnly === undefined ? composerPick : undefined);
	const pickOpen = $derived(pick?.open === true);
	const activeKey = $derived(pickOpen && pick!.active !== undefined && pick!.keys.includes(pick!.active) ? pick!.active : undefined);
	const pickShown = $derived(pickOpen && pick!.keys.length > 0);

	const hasContent = (message: Message): boolean => message.text !== '' || (message.toolCalls?.length ?? 0) > 0;

	function send(): void {
		if (sendable) onSend(draft.trim());
	}

	function handleKeydown(event: KeyboardEvent): void {
		onComposerKeydown?.(event);
		const cancelledByApp = event.defaultPrevented;
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			if (!cancelledByApp && !event.isComposing) send();
		} else if (event.key === 'Escape' && !cancelledByApp && !event.isComposing && pickOpen) {
			event.preventDefault();
			pick!.onDismiss();
		}
	}

	function handleBlur(): void {
		if (pickOpen) pick!.onDismiss();
	}

	function handleInput(event: Event & { currentTarget: HTMLTextAreaElement }): void {
		const field = event.currentTarget;
		onDraft(field.value, field.selectionStart);
	}

	// The field keeps the focus, so the browser never scrolls the active option into view; the part does.
	$effect(() => {
		void pick?.keys;
		if (activeKey !== undefined) pickList!.children[pick!.keys.indexOf(activeKey)].scrollIntoView({ block: 'nearest' });
	});

	// Pressing anywhere in the composer's box but the field keeps the focus in the field: the keyboard stays open, a tap on Send lands and a press on the pick list does not close it.
	$effect(() => {
		const box = composerBox!;
		function keepFocusInField(event: MouseEvent): void {
			if (event.target !== field) event.preventDefault();
		}
		box.addEventListener('mousedown', keepFocusInField);
		return () => box.removeEventListener('mousedown', keepFocusInField);
	});
</script>

<div class="helper-chat">
	{#if history.state === 'loading'}
		<p class="subtle">{words['helperChat.loading']}</p>
	{:else if history.state === 'failed'}
		<p class="failure" role="alert">{history.failure}</p>
	{:else}
		<!-- A scrolling list takes the keyboard focus, so a person without a pointer can scroll it. -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<div
			class="list"
			role="region"
			aria-label={words['helperChat.listLabel']({ name: helperName })}
			bind:this={list}
			onscroll={onListScroll}
			tabindex="0"
		>
			{#if messages.length === 0}
				<p class="subtle">{emptyHint}</p>
			{:else}
				<ol role="list" aria-label={words['helperChat.listLabel']({ name: helperName })}>
					{#each messages as message, index (index)}
						<li class={['message', message.role]}>
							<span class="visually-hidden">{words['helperChat.speaker']({
								name: message.role === 'user' ? words['helperChat.you'] : helperName
							})}</span>
							{#if hasContent(message) || (thinking && index === messages.length - 1)}
								<div class="bubble">
									{#if message.role === 'assistant'}
										<span class="mark"><AiMark /></span>
									{/if}
									{#each message.toolCalls ?? [] as call, callIndex (callIndex)}
										<div class="tool-call" title={toolCallTitle?.(call)}>
											<span>{words['helperChat.ranTool']({ tool: call.name })}</span>
											{@render toolCallTarget?.({ call, message })}
										</div>
									{/each}
									{#if message.text !== ''}
										<div class="text">{message.text}</div>
									{/if}
									{#if thinking && index === messages.length - 1}
										<p class="thinking" aria-hidden="true">{thinkingWord}</p>
									{/if}
								</div>
							{/if}
							{@render problemLine?.({ message, index })}
						</li>
					{/each}
				</ol>
			{/if}
		</div>
	{/if}

	<div class="composer">
		{#if readOnly}
			<div class="read-only">{@render readOnly()}</div>
		{/if}
		{@render composerTop?.()}
		<div class="composer-box" bind:this={composerBox}>
			{#if pick}
				<div class="pick-list" role="listbox" id={listId} aria-label={pick.label} hidden={!pickShown} bind:this={pickList}>
					{#each pick.keys as key (key)}
						<!-- The field keeps the focus and takes the keys, so an option takes only the pointer. -->
						<!-- svelte-ignore a11y_click_events_have_key_events, a11y_interactive_supports_focus -->
						<div role="option" id={optionId(key)} aria-selected={key === activeKey} onclick={() => pick.onPick(key)}>
							{@render pick.option(key)}
						</div>
					{/each}
				</div>
				<p class="pick-empty" role="status">{pickOpen && pick.keys.length === 0 ? pick.empty : ''}</p>
			{/if}
			<textarea
				rows="1"
				bind:this={field}
				aria-autocomplete={pick ? 'list' : undefined}
				aria-haspopup={pick ? 'listbox' : undefined}
				aria-controls={pick ? listId : undefined}
				aria-activedescendant={activeKey === undefined ? undefined : optionId(activeKey)}
				aria-label={words['helperChat.composerLabel']({ name: helperName })}
				{placeholder}
				disabled={readOnly !== undefined}
				value={draft}
				oninput={handleInput}
				onkeydown={handleKeydown}
				onblur={handleBlur}
			></textarea>
			<button class="send" type="button" disabled={!sendable} onclick={send}>{words['helperChat.send']}</button>
		</div>
	</div>
	<p class="visually-hidden" role="status">{thinking ? thinkingWord : ''}</p>
</div>

<style>
	.helper-chat {
		position: relative;
		display: flex;
		flex-direction: column;
		height: 100%;
		min-height: 0;
		font-family: var(--font-body);
		color: var(--text);
	}
	.list {
		flex: 1 1 auto;
		min-height: 0;
		overflow-y: auto;
		padding: 8px;
	}
	.list:focus-visible {
		outline: 2.5px solid var(--accent);
		outline-offset: -2.5px;
	}
	.subtle {
		margin: 0;
		color: var(--text-muted);
	}
	p.subtle {
		padding: 8px;
	}
	.failure {
		margin: 0;
		padding: 8px;
		color: var(--fail);
	}
	ol {
		margin: 0;
		padding: 0;
		list-style-type: none;
	}
	.message {
		display: flex;
		flex-direction: column;
		gap: 4px;
		max-width: 85%;
		margin-bottom: 8px;
	}
	.message.user {
		align-items: flex-end;
		margin-left: auto;
	}
	.message.assistant {
		align-items: flex-start;
	}
	.bubble {
		display: flex;
		flex-direction: column;
		min-width: 0;
		max-width: 100%;
		padding: 8px 12px;
		border-radius: 12px;
		overflow-wrap: anywhere;
	}
	.bubble > :not(:first-child):not(:empty) {
		margin-top: 4px;
	}
	.user .bubble {
		background: var(--accent);
		color: var(--on-accent);
	}
	.assistant .bubble {
		border: 1px solid var(--border);
		background: var(--surface);
	}
	.mark {
		display: flex;
		color: var(--text-muted);
	}
	.text {
		white-space: pre-wrap;
	}
	.tool-call {
		display: flex;
		flex-wrap: wrap;
		gap: 0 6px;
		color: var(--text-muted);
		font-family: ui-monospace, Menlo, Consolas, monospace;
		font-size: 0.8rem;
	}
	.thinking {
		margin: 0;
		color: var(--text-muted);
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		margin: 0;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
	.composer {
		display: flex;
		flex: none;
		flex-direction: column;
		gap: 8px;
		padding: 8px;
		border-top: 1px solid var(--border);
	}
	.read-only {
		padding: 8px 12px;
		border-radius: 8px;
		background: var(--surface-hover);
		color: var(--text);
	}
	.composer-box {
		position: relative;
		display: flex;
		align-items: flex-end;
		gap: 8px;
	}
	.pick-list,
	.pick-empty {
		position: absolute;
		right: 0;
		bottom: 100%;
		left: 0;
		margin: 0 0 4px;
	}
	.pick-list,
	.pick-empty:not(:empty) {
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.14);
	}
	.pick-list {
		padding: 4px 0;
		max-height: 10rem;
		overflow-y: auto;
	}
	.pick-empty {
		color: var(--text-muted);
	}
	.pick-empty:not(:empty),
	.pick-list [role='option'] {
		padding: 4px 12px;
	}
	.pick-list [role='option'] {
		min-height: 24px;
		cursor: pointer;
	}
	.pick-list [aria-selected='true'] {
		background: var(--surface-hover);
	}
	textarea {
		flex: 1 1 auto;
		box-sizing: border-box;
		min-width: 0;
		min-height: 44px;
		max-height: 10rem;
		padding: 10px 12px;
		border: 1px solid var(--border);
		border-radius: 8px;
		background: var(--surface);
		color: var(--text);
		font: inherit;
		field-sizing: content;
		resize: none;
	}
	textarea::placeholder {
		color: var(--text-muted);
	}
	textarea:disabled {
		background: var(--bg-deep);
		color: var(--text-muted);
	}
	textarea:focus-visible,
	.send:focus-visible {
		outline: 2.5px solid var(--accent);
		outline-offset: 2px;
	}
	.send {
		flex: none;
		min-width: 44px;
		min-height: 44px;
		padding: 0 16px;
		border: 0;
		border-radius: 6px;
		background: var(--accent);
		color: var(--on-accent);
		font-family: var(--font-display);
		font-size: 1rem;
		text-transform: uppercase;
		cursor: pointer;
	}
	.send:disabled {
		opacity: 0.5;
		cursor: default;
	}
</style>
