import { mount } from 'svelte';
import { expect, it } from 'vitest';
import AgentControl from './AgentControl.svelte';
import SignInPage from './SignInPage.svelte';
import { mountInDocument } from './mountInDocument.test.helper.ts';
import { loadWords } from './words/index.ts';

const en = await loadWords('en');

/** The banner's tags, roles and child order with its words taken out; classes are private to the part. */
function bannerStructure(page: HTMLElement, text: string): string {
	const alert = page.querySelector('[role="alert"]')!;
	expect(alert.textContent).toContain(text);
	const copy = alert.cloneNode(true) as HTMLElement;
	for (const element of [copy, ...copy.querySelectorAll('*')]) element.removeAttribute('class');
	return copy.outerHTML.replace(text, '');
}

it('draws the sign-in failure and the agent refusal as the same banner', async () => {
	const signIn = await mountInDocument((target) =>
		mount(SignInPage, {
			target,
			props: { appName: 'Hallucinai', state: { page: 'login-failed', signInHref: '/auth/login' }, legalLinks: [], words: en }
		})
	);
	const control = await mountInDocument((target) =>
		mount(AgentControl, { target, props: { rows: [], onCall: () => {}, refusal: 'try-again', words: en } })
	);
	expect(bannerStructure(control, en['agent.tryAgain'])).toBe(bannerStructure(signIn, en['signIn.loginFailedBanner']));
});
