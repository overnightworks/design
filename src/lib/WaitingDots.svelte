<script lang="ts"></script>

<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>

<style>
	.dots {
		display: inline-flex;
		align-items: center;
		gap: 4px;
	}
	.dots i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
		background: currentColor;
		opacity: 0.6;
	}
	@media (prefers-reduced-motion: no-preference) {
		.dots i {
			animation: hop 1.2s ease-in-out infinite;
		}
		.dots i:nth-child(2) {
			animation-delay: 0.12s;
		}
		.dots i:nth-child(3) {
			animation-delay: 0.24s;
		}
	}
	@keyframes hop {
		0%,
		60%,
		100% {
			translate: 0 0;
			opacity: 0.45;
		}
		30% {
			translate: 0 -5px;
			opacity: 1;
		}
	}
</style>
