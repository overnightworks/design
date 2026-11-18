<script lang="ts">
	let { text }: { text: string } = $props();
</script>

<div class="banner" role="alert">
	<span class="fail-shape"><i></i></span>
	<span>{text}</span>
</div>

<style>
	.banner {
		display: flex;
		gap: 10px;
		align-items: flex-start;
		padding: 10px 12px;
		border: 1px solid var(--fail);
		border-left-width: 3px;
		border-radius: 4px;
		background: var(--fail-soft);
		font-size: 13.5px;
		text-align: left;
		color: var(--text);
	}
	.fail-shape {
		margin-top: 3px;
		display: inline-flex;
		color: var(--fail);
	}
	.fail-shape i {
		width: 12px;
		height: 12px;
		flex: none;
		display: inline-block;
		background: var(--fail);
		clip-path: polygon(50% 0%, 100% 100%, 0% 100%);
	}
</style>
