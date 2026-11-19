import { mount, tick, unmount } from 'svelte';
import { afterEach } from 'vitest';

const mounted: { target: HTMLElement; component: ReturnType<typeof mount> }[] = [];

/** Unmounts everything mounted so far; the helper does it after each test. */
export async function unmountMounted(): Promise<void> {
	for (const { target, component } of mounted.splice(0)) {
		await unmount(component);
		target.remove();
	}
}

afterEach(unmountMounted);

/** Mounts what `mountInto` mounts into a fresh element of the document, or into `place`, and unmounts it after the test. */
export async function mountInDocument(
	mountInto: (target: HTMLElement) => ReturnType<typeof mount>,
	place?: HTMLElement
): Promise<HTMLElement> {
	const target = place ?? document.createElement('div');
	if (!place) document.body.append(target);
	mounted.push({ target, component: mountInto(target) });
	await tick();
	return target;
}
