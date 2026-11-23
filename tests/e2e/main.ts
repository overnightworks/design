import './app.css';
import { mount } from 'svelte';
import { SvelteMap } from 'svelte/reactivity';
import {
	AccountMenu,
	AgentControl,
	EarMark,
	HearingSwitch,
	LegalLinks,
	SignInPage,
	TurnState,
	loadKitWords,
	type AgentControlOutcome,
	type AgentControlRefusal,
	type AgentRow,
	type HearingKind,
	type KitLanguage,
	type KitWords,
	type SignInState,
	type ThemeChoice,
	type TurnOutcome
} from 'overnightworks-design';
import HelperChatStub from './HelperChatStub.svelte';
import MarkedSentence from './MarkedSentence.svelte';

declare global {
	interface Window {
		/** Every report the menu, the agent control, the hearing switch, the helper chat's stub app or the sign-in page made, in order. */
		reports: string[];
	}
}

const legalLinks = [
	{ label: 'Imprint', href: '/imprint' },
	{ label: 'Privacy', href: '/privacy' }
];

/** Long enough that the row wraps in the 256 px panel, as an app's real labels do. */
const menuLegalLinks = [
	{ label: 'Impressum', href: '/imprint' },
	{ label: 'Datenschutz', href: '/privacy' },
	{ label: 'Nutzungsbedingungen', href: '/terms' }
];

/** The app's side of the theme: it keeps the choice in memory and sets data-theme, as an app would. */
function themeHolder(takesChoice: boolean) {
	const held = new SvelteMap<string, ThemeChoice>([['choice', 'follow-system']]);
	const apply = (choice: ThemeChoice): void => {
		if (choice === 'follow-system') document.documentElement.removeAttribute('data-theme');
		else document.documentElement.setAttribute('data-theme', choice);
	};
	return {
		get choice() {
			return held.get('choice')!;
		},
		onChange(choice: ThemeChoice) {
			window.reports.push(`theme:${choice}`);
			if (!takesChoice) return;
			held.set('choice', choice);
			apply(choice);
		}
	};
}

const menuVariants = ['default', 'action', 'no-theme', 'ignore'];

/** A variant the part does not render is a wrong entry in `variants.ts`, so it fails the page instead of showing a default state. */
function knownVariants(part: string, known: readonly string[], variant: string): string {
	const unknown = variant.split(',').filter((flag) => flag !== '' && !known.includes(flag));
	if (unknown.length > 0) throw new Error(`The ${part} part renders no state for ${unknown.join(',')}`);
	return variant;
}

function mountMenu(variant: string, words: KitWords): void {
	knownVariants('account menu', menuVariants, variant);
	window.reports = [];
	const report = (what: string) => () => void window.reports.push(what);
	const common = {
		name: 'Alex mcExample',
		accountHref: '/account',
		onAccountOpen: report('account'),
		appRows: [{ label: 'Settings', onSelect: report('settings') }] as const,
		legalLinks: menuLegalLinks
	};
	const logOut =
		variant === 'action' ? { logOutAction: '/logout' } : { onLogOut: report('logout') };
	const theme = variant === 'no-theme' ? undefined : themeHolder(variant !== 'ignore');
	mount(AccountMenu, { target: document.body, props: { ...common, ...logOut, theme, words } });
}

/** A long name shows how a row keeps its action in the panel. */
const agentRows: AgentRow[] = [
	{ key: 'key-mozart', name: 'Mozart', state: 'available' },
	{ key: 'key-bach', name: 'Bach', state: 'inviting' },
	{ key: 'key-leonardo', name: 'Leonardo da Vinci, the long-named painter and inventor', state: 'here' }
];

/** The variants that end Mozart's call, by the outcome the page passes. */
const endedVariants: Record<string, AgentControlOutcome> = {
	'ended-no-answer': 'no-answer',
	'ended-busy': 'busy',
	'ended-owner-absent': 'owner-absent'
};

function rowsOfVariant(variant: string): AgentRow[] {
	if (variant.startsWith('empty')) return [];
	const outcome = endedVariants[variant];
	return outcome ? [{ key: 'key-mozart', name: 'Mozart', state: 'ended', outcome }, ...agentRows.slice(1)] : agentRows;
}

function refusalOfVariant(variant: string): AgentControlRefusal | undefined {
	if (variant === 'refusal' || variant === 'empty-refusal') return 'owner-absent';
	return variant === 'empty-place-full' || variant === 'full-place-full' ? 'place-full' : undefined;
}

const agentVariants = [
	'default', 'full', 'full-place-full', 'refusal', 'empty', 'empty-full', 'empty-refusal', 'empty-place-full',
	...Object.keys(endedVariants)
];

function mountAgentControl(variant: string, words: KitWords): void {
	knownVariants('agent control', agentVariants, variant);
	window.reports = [];
	mount(AgentControl, {
		target: document.body,
		props: {
			rows: rowsOfVariant(variant),
			full: ['empty-full', 'empty-place-full', 'full', 'full-place-full'].includes(variant),
			refusal: refusalOfVariant(variant),
			onCall: (key: string) => void window.reports.push(`call:${key}`),
			onSendAway: (key: string) => void window.reports.push(`leave:${key}`),
			words
		}
	});
}

/**
 * The chips on a stand-in for the video they always sit on, held by the app as a controlled switch is. The
 * variant is a comma-separated list: `off` starts them off, `ignore` is an app that never takes the change,
 * `see` adds the see chip after the two others, and `narrow` shows a compact see chip beside the hearing
 * chip in a stage too narrow for both in full. `hear`, `listen` and `see` pick the chips shown (in that order,
 * `reverse` flips the DOM order), `compact` shows every chip compact, and `row` sets them side by side with no
 * gap instead of stacked.
 */
const hearingFlags = ['hear', 'listen', 'see', 'off', 'compact', 'narrow', 'row', 'reverse', 'ignore'];

function mountHearingSwitches(variant: string, words: KitWords): void {
	knownVariants('hearing switch', hearingFlags, variant);
	window.reports = [];
	const flags = new Set(variant.split(','));
	const chosen = (['hear', 'listen', 'see'] as const).filter((kind) => flags.has(kind));
	const shown: HearingKind[] =
		flags.has('hear') || flags.has('listen')
			? chosen
			: flags.has('narrow')
				? ['see', 'hear']
				: flags.has('see')
					? ['hear', 'listen', 'see']
					: ['hear', 'listen'];
	const kinds = flags.has('reverse') ? [...shown].reverse() : shown;
	const held = new SvelteMap<HearingKind, boolean>(kinds.map((kind) => [kind, !flags.has('off')]));
	const stage = document.createElement('div');
	stage.className = flags.has('narrow')
		? 'hearing-stage hearing-stage-narrow'
		: flags.has('row')
			? 'hearing-stage hearing-stage-row'
			: 'hearing-stage';
	document.body.append(stage);
	for (const kind of kinds) {
		mount(HearingSwitch, {
			target: stage,
			props: {
				kind,
				compact: flags.has('compact') || (flags.has('narrow') && kind === 'see'),
				get on() {
					return held.get(kind)!;
				},
				onChange(on: boolean) {
					window.reports.push(`${kind}:${on}`);
					if (!flags.has('ignore')) held.set(kind, on);
				},
				words
			}
		});
	}
}

/**
 * Ear marks stacked in a column on a stand-in for a tile, as an app places them: `one` shows a single mark
 * on one's own tile, `two` stacks two agents' marks on another person's tile, `long` shows an agent whose
 * name does not fit.
 */
function mountEarMarks(variant: string, words: KitWords): void {
	knownVariants('ear mark', ['one', 'two', 'long'], variant);
	const stage = document.createElement('div');
	stage.className = 'ear-stage';
	document.body.append(stage);
	const agents =
		variant === 'long'
			? ['Leonardo da Vinci, the long-named painter and inventor']
			: variant === 'two'
				? ['Mozart', 'Bach']
				: ['Mozart'];
	for (const agent of agents) {
		mount(EarMark, { target: stage, props: { agent, person: variant === 'two' ? 'Anna' : undefined, words } });
	}
}

/**
 * The turn-state part: `alone` stacks the four outcomes and an unstated one, `here` shows it in the here
 * row of an agent control beside a short and a long agent name.
 */
function mountTurnState(variant: string, words: KitWords): void {
	knownVariants('turn state', ['alone', 'here'], variant);
	const outcomes: (TurnOutcome | undefined)[] = ['not_enabled', 'busy', 'budget_spent', 'unavailable', undefined];
	if (variant === 'here') {
		const narrowStage = document.createElement('div');
		narrowStage.className = 'turn-stage-narrow';
		document.body.append(narrowStage);
		mount(AgentControl, {
			target: narrowStage,
			props: {
				rows: [
					{ key: 'key-mozart', name: 'Mozart', state: 'here', turnState: 'busy' },
					{ key: 'key-leonardo', name: 'Leonardo da Vinci, the long-named painter and inventor', state: 'here', turnState: 'unavailable' },
					{ key: 'key-bach', name: 'Bach', state: 'here' }
				],
				onCall: () => {},
				onSendAway: () => {},
				words
			}
		});
		return;
	}
	const stage = document.createElement('div');
	stage.className = 'turn-stage';
	document.body.append(stage);
	for (const outcome of outcomes) {
		const row = document.createElement('div');
		stage.append(row);
		mount(TurnState, { target: row, props: { outcome, words } });
	}
}

const helperVariants = ['base', 'empty', 'scroll', 'running', 'problem', 'loading', 'failed', 'draft', 'archived'];

/** The languages this page offers; the type check fails when the kit lacks one. */
const pageLanguages = ['de', 'en'] as const satisfies readonly KitLanguage[];

const query = new URLSearchParams(location.search);
/** The app's side of the kit's words: the loader called with the language the page names, `?lang=`, or en. */
const pageLanguage = pageLanguages.find((candidate) => candidate === query.get('lang')) ?? 'en';
document.documentElement.lang = pageLanguage;

/** The app's side of the theme at load: `?theme=` sets data-theme, as an app does once a person has chosen. */
const pageThemes = ['light', 'dark'] as const satisfies readonly ThemeChoice[];
const pageTheme = pageThemes.find((candidate) => candidate === query.get('theme'));
if (pageTheme) document.documentElement.setAttribute('data-theme', pageTheme);

/** Names the part this page renders, so a frame shows which state it landed in; the parts page's spec reads it. */
const markPart = (part: string): void => document.documentElement.setAttribute('data-part', part);

if (query.has('words')) {
	markPart('kit-word');
	const tag = query.get('words');
	const language = pageLanguages.find((candidate) => candidate === tag) ?? pageLanguages[0];
	document.documentElement.lang = language;
	void loadKitWords(language).then((words) => {
		document.body.innerHTML = `<p role="status">${words['account.logOut']}</p>`;
	});
} else if (query.has('typed')) {
	markPart('typed-heading');
	// A person typed the name; the app wrote the words around it.
	document.body.innerHTML = '<main><h1>Source <span class="as-typed">talks</span></h1><h2>Second</h2></main>';
} else if (query.has('tokens')) {
	markPart('kit-tokens');
	// One text sample per pair the kit promises at AA; a translucent surface sits on an opaque one.
	const stateInks = ['--text', '--text-muted', '--ok', '--busy', '--fail'];
	const neutralSurfaces = ['--bg', '--bg-deep', '--surface', '--surface-hover', '--header-bg'];
	const softSurfaces = [
		['--ok-soft', ['--ok', '--text']],
		['--busy-soft', ['--busy', '--text']],
		['--fail-soft', ['--fail', '--text']]
	] as const;
	const stageInks = ['--on-stage', '--on-stage-soft'];
	const sample = (surface: string, ink: string) =>
		`<p class="token-sample" style="--token-surface: var(${surface}); --token-ink: var(${ink})">${ink} on ${surface}</p>`;
	const samples = [
		...neutralSurfaces.flatMap((surface) => stateInks.map((ink) => sample(surface, ink))),
		`<div class="token-sample" style="--token-surface: var(--bg); --token-ink: var(--text)">${stateInks
			.map((ink) => sample('--card-bg', ink))
			.join('')}</div>`,
		...softSurfaces.flatMap(([surface, inks]) => inks.map((ink) => sample(surface, ink))),
		`<div class="token-sample" style="--token-surface: var(--stage); --token-ink: var(--on-stage)">${['--stage', '--glass', '--glass-dark']
			.map((surface) => `<div>${stageInks.map((ink) => sample(surface, ink)).join('')}</div>`)
			.join('')}</div>`,
		sample('--accent', '--on-accent')
	];
	document.body.innerHTML = `<main>${samples.join('')}</main>`;
} else if (query.has('legal')) {
	markPart('sign-in-card');
	// The markup contract of a page that cannot render Svelte, beside the component's own row.
	const words = await loadKitWords(pageLanguage);
	document.body.innerHTML = `<div id="written"><nav class="legal" aria-label="${words['legalLinks.name']}">${legalLinks
		.map((link) => `<a href="${link.href}">${link.label}</a>`)
		.join('')}</nav></div><div id="component"></div>`;
	mount(LegalLinks, {
		target: document.getElementById('component')!,
		props: { links: legalLinks, words }
	});
} else if (query.has('sign-in-card')) {
	markPart('sign-in-card');
	// The markup contract of a page that cannot render Svelte, beside the component's own card: a card of wrapper
	// elements, as a templated login page writes it, in a container wider than the component's card.
	const words = await loadKitWords(pageLanguage);
	const signedOut = knownVariants('sign-in card', ['signed-out', 'no-access'], query.get('sign-in-card') ?? '') === 'signed-out';
	document.body.innerHTML = `<div id="written" style="width: 480px; max-width: 100%"><main class="sign-in-card">
		<div><h1>${words['signIn.loggedOut']}</h1></div>
		<div><form action="/login" method="post">
			<div><label for="name">Name</label> <input id="name" name="name"></div>
			<div><a class="sign-in-action primary" href="/login">${words['signIn.logIn']}</a> <button class="sign-in-action secondary" type="submit">${words['signIn.logOut']}</button></div>
		</form></div>
		<div><div id="limited" style="width: 140px"><a class="sign-in-action secondary" href="/other">Continue with another account</a></div></div>
	</main></div><div id="component"></div>`;
	mount(SignInPage, {
		target: document.getElementById('component')!,
		props: {
			appName: 'Probe',
			state: signedOut
				? { page: 'signed-out', signInHref: '/login' }
				: { page: 'no-access', logOutAction: '/logout' },
			legalLinks: legalLinks.slice(0, 2),
			words
		}
	});
} else if (query.has('marked')) {
	markPart('marked');
	mount(MarkedSentence, { target: document.body });
} else if (query.has('helper')) {
	markPart('helper-chat');
	window.reports = [];
	mount(HelperChatStub, {
		target: document.body,
		props: { variant: knownVariants('helper chat', helperVariants, query.get('helper') ?? ''), words: await loadKitWords(pageLanguage) }
	});
} else if (query.has('turn')) {
	markPart('turn-state');
	mountTurnState(query.get('turn') ?? '', await loadKitWords(pageLanguage));
} else if (query.has('ear')) {
	markPart('ear-mark');
	mountEarMarks(query.get('ear') ?? '', await loadKitWords(pageLanguage));
} else if (query.has('hearing')) {
	markPart('hearing-switch');
	mountHearingSwitches(query.get('hearing') ?? '', await loadKitWords(pageLanguage));
} else if (query.has('agents')) {
	markPart('agent-control');
	mountAgentControl(query.get('agents') ?? '', await loadKitWords(pageLanguage));
} else if (query.has('menu')) {
	markPart('account-menu');
	mountMenu(query.get('menu') ?? '', await loadKitWords(pageLanguage));
} else {
	const signInKeys = ['signing-in', 'window-blocked', 'unfinished', 'login-failed', 'no-access', 'on-sign-in'];
	const unknown = [...query.keys()].filter((key) => !['lang', 'theme', ...signInKeys].includes(key));
	if (unknown.length > 0) throw new Error(`The consumer renders no state for ?${unknown.join('&')}`);
	markPart('sign-in-page');
	window.reports = [];
	const state: SignInState = query.has('signing-in')
		? { page: 'signing-in', tabHref: '/app' }
		: query.has('window-blocked')
			? { page: 'window-blocked', tabHref: '/app' }
			: query.has('unfinished')
				? { page: 'signed-out', signInHref: '/login', unfinished: true }
				: query.has('login-failed')
					? { page: 'login-failed', signInHref: '/login' }
					: query.has('no-access')
						? { page: 'no-access', logOutAction: '/logout' }
						: query.has('on-sign-in')
							? { page: 'signed-out', signInHref: '/login', onSignIn: () => void window.reports.push('sign-in') }
							: { page: 'signed-out', signInHref: '/login' };
	mount(SignInPage, {
		target: document.body,
		props: {
			appName: 'Probe',
			state,
			legalLinks: legalLinks.slice(0, 2),
			words: await loadKitWords(pageLanguage)
		}
	});
}
