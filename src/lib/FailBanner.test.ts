import { mount, tick, unmount } from 'svelte';
import { afterEach, expect, it } from 'vitest';
import AgentControl from './AgentControl.svelte';
import SignInPage from './SignInPage.svelte';
import { loadWords } from './words/index.ts';

const en = await loadWords('en');

const mounted: { target: HTMLElement; component: ReturnType<typeof mount> }[] = [];

async function render(mountInto: (target: HTMLElement) => ReturnType<typeof mount>): Promise<HTMLElement> {
	const target = document.createElement('div');
	document.body.append(target);
	mounted.push({ target, component: mountInto(target) });
	await tick();
	return target;
}

afterEach(async () => {
	for (const { target, component } of mounted.splice(0)) {
		await unmount(component);
		target.remove();
	}
});

/** The banner's tags, roles and child order with its words taken out; classes are private to the part. */
function bannerStructure(page: HTMLElement, text: string): string {
	const alert = page.querySelector('[role="alert"]')!;
	expect(alert.textContent).toContain(text);
	const copy = alert.cloneNode(true) as HTMLElement;
	for (const element of [copy, ...copy.querySelectorAll('*')]) element.removeAttribute('class');
	return copy.outerHTML.replace(text, '');
}

it('draws the sign-in failure and the agent refusal as the same banner', async () => {
	const signIn = await render((target) =>
		mount(SignInPage, {
			target,
			props: { appName: 'Hallucinai', state: { page: 'login-failed', signInHref: '/auth/login' }, legalLinks: [], words: en }
		})
	);
	const control = await render((target) =>
		mount(AgentControl, { target, props: { rows: [], onCall: () => {}, refusal: 'try-again', words: en } })
	);
	expect(bannerStructure(control, en['agent.tryAgain'])).toBe(bannerStructure(signIn, en['signIn.loginFailedBanner']));
});
