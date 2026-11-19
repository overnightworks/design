import { svelte } from '@sveltejs/vite-plugin-svelte';
import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		coverage: {
			// Istanbul counts the branches the instrumented consumer build counts in the browser, so `pnpm run coverage:merge` can add the two reports up.
			provider: 'istanbul',
			reporter: [['json', { file: 'unit.json' }], ['json-summary', { file: '../unit-summary.json' }], 'text-summary'],
			reportsDirectory: 'coverage/remapped',
			include: ['src/lib/**'],
			// The generated words hold data and one loader line; the consumer build proves them.
			exclude: ['**/*.test.*', 'src/lib/words/**']
		},
		projects: [
			{
				// The consumer build is a production compile; the unit layer tests that compile, so one branch has one entry in both reports.
				plugins: [svelte({ compilerOptions: { dev: false } })],
				resolve: { conditions: ['browser'] },
				test: {
					name: 'client',
					include: ['src/**/*.test.ts'],
					exclude: ['src/**/*.ssr.test.ts'],
					environment: 'jsdom'
				}
			},
			{
				plugins: [svelte()],
				test: { name: 'server', include: ['src/**/*.ssr.test.ts'], environment: 'node' }
			}
		]
	}
});
