/** A shared part, or a page of the consumers that proves one rule of the kit, as the parts page names it. */
export interface Part {
	/** The file name of the part's page. */
	id: string;
	name: string;
	summary: string;
	/** The height of each state's frame on the part's page, in pixels. */
	frameHeight: number;
}

/** One state of a part: the query that makes the consumer render it. */
export interface Variant {
	part: Part;
	label: string;
	query: string;
}

const part = (id: string, name: string, summary: string, frameHeight: number): Part => ({ id, name, summary, frameHeight });

const signInPage = part('sign-in-page', 'SignInPage', 'The page that asks a person to sign in, and what it says when that does not work.', 380);
const signInCard = part('sign-in-card', 'Card and legal row (CSS)', 'The markup contract of a page that cannot render Svelte, beside the component it matches.', 560);
const accountMenu = part('account-menu', 'AccountMenu', 'The menu behind a person’s name: account, the app’s own rows, theme, legal links and log out.', 320);
const agentControl = part('agent-control', 'AgentControl', 'The panel with which a person calls an agent into a place and asks it to leave.', 200);
const turnState = part('turn-state', 'TurnState', 'Why an agent has no turn at the moment, in the words of the kit.', 240);
const hearingSwitch = part('hearing-switch', 'HearingSwitch', 'The chips on a video with which a person switches what an agent hears and sees.', 200);
const earMark = part('ear-mark', 'EarMark', 'The mark on a tile that tells who an agent is listening to.', 160);
const helperChat = part('helper-chat', 'HelperChat', 'The conversation with a helper, in each state a conversation can be in.', 480);
const marked = part('marked', 'Marked', 'A sentence in which the words a person typed are marked.', 120);
const typedHeading = part('typed-heading', 'Typed heading', 'A heading around a name a person typed.', 140);
const kitWord = part('kit-word', 'Kit word', 'One word of the kit, loaded in a language on its own.', 100);
const kitTokens = part('kit-tokens', 'Kit tokens', 'Every pair of ink and surface the kit promises at WCAG 2.2 AA.', 640);

/** The one list of states the consumers render, in the order the parts page shows them. */
export const variants: readonly Variant[] = [
	{ part: agentControl, label: 'Three agents: available, calling, here', query: 'agents=default' },
	{ part: agentControl, label: 'A call ended: no answer', query: 'agents=ended-no-answer' },
	{ part: agentControl, label: 'A call ended: busy', query: 'agents=ended-busy' },
	{ part: agentControl, label: 'A call ended: its owner is absent', query: 'agents=ended-owner-absent' },
	{ part: agentControl, label: 'The place is full', query: 'agents=full' },
	{ part: agentControl, label: 'The place is full and a call is refused: no place', query: 'agents=full-place-full' },
	{ part: agentControl, label: 'A call is refused: its owner is absent', query: 'agents=refusal' },
	{ part: agentControl, label: 'No agent', query: 'agents=empty' },
	{ part: agentControl, label: 'No agent, the place is full', query: 'agents=empty-full' },
	{ part: agentControl, label: 'No agent, a call is refused: its owner is absent', query: 'agents=empty-refusal' },
	{ part: agentControl, label: 'No agent, a call is refused: no place', query: 'agents=empty-place-full' },
	{ part: signInPage, label: 'Signed out', query: '' },
	{ part: signInPage, label: 'Signing in in another tab', query: 'signing-in' },
	{ part: signInPage, label: 'The other tab was blocked', query: 'window-blocked' },
	{ part: signInPage, label: 'Sign-in left unfinished', query: 'unfinished' },
	{ part: signInPage, label: 'Sign-in failed', query: 'login-failed' },
	{ part: signInPage, label: 'Signed in without access', query: 'no-access' },
	{ part: signInPage, label: 'The app handles the sign-in click', query: 'on-sign-in' },
	{ part: accountMenu, label: 'With a theme choice and a log-out handler', query: 'menu=default' },
	{ part: accountMenu, label: 'Log out as a form post', query: 'menu=action' },
	{ part: accountMenu, label: 'Without a theme choice', query: 'menu=no-theme' },
	{ part: accountMenu, label: 'An app that ignores the theme choice', query: 'menu=ignore' },
	{ part: hearingSwitch, label: 'Hear chip, on', query: 'hearing=hear' },
	{ part: hearingSwitch, label: 'Listen chip, on', query: 'hearing=listen' },
	{ part: hearingSwitch, label: 'Three chips, see chip on', query: 'hearing=see' },
	{ part: hearingSwitch, label: 'Hear chip, off', query: 'hearing=hear,off' },
	{ part: hearingSwitch, label: 'Listen chip, off', query: 'hearing=listen,off' },
	{ part: hearingSwitch, label: 'Three chips, see chip off', query: 'hearing=see,off' },
	{ part: hearingSwitch, label: 'Hear chip, compact', query: 'hearing=hear,compact' },
	{ part: hearingSwitch, label: 'See and hear chips in a narrow tile', query: 'hearing=narrow' },
	{ part: hearingSwitch, label: 'Three chips side by side', query: 'hearing=hear,listen,see,row' },
	{ part: hearingSwitch, label: 'Three chips in reverse order', query: 'hearing=hear,listen,see,reverse' },
	{ part: hearingSwitch, label: 'Three compact chips side by side in reverse order', query: 'hearing=hear,listen,see,compact,row,reverse' },
	{ part: helperChat, label: 'A conversation', query: 'helper=base' },
	{ part: helperChat, label: 'No message yet', query: 'helper=empty' },
	{ part: helperChat, label: 'A long conversation', query: 'helper=scroll' },
	{ part: helperChat, label: 'A reply is coming', query: 'helper=running' },
	{ part: helperChat, label: 'A reply broke off', query: 'helper=problem' },
	{ part: helperChat, label: 'The conversation is loading', query: 'helper=loading' },
	{ part: helperChat, label: 'The conversation failed to load', query: 'helper=failed' },
	{ part: helperChat, label: 'A draft is kept', query: 'helper=draft' },
	{ part: helperChat, label: 'An archived conversation', query: 'helper=archived' },
	{ part: earMark, label: 'One agent on one’s own tile', query: 'ear=one' },
	{ part: earMark, label: 'Two agents on another person’s tile', query: 'ear=two' },
	{ part: earMark, label: 'An agent whose name does not fit', query: 'ear=long' },
	{ part: turnState, label: 'Each outcome on its own', query: 'turn=alone' },
	{ part: turnState, label: 'In the here row of an agent control', query: 'turn=here' },
	{ part: signInCard, label: 'Signed-out card', query: 'sign-in-card=signed-out' },
	{ part: signInCard, label: 'No-access card', query: 'sign-in-card=no-access' },
	{ part: signInCard, label: 'Legal row', query: 'legal' },
	{ part: marked, label: 'A marked sentence', query: 'marked' },
	{ part: typedHeading, label: 'A typed name in a heading', query: 'typed' },
	{ part: kitWord, label: 'In German', query: 'words=de' },
	{ part: kitWord, label: 'In English', query: 'words=en' },
	{ part: kitTokens, label: 'Every pair of ink and surface', query: 'tokens' }
];

/** The parts in the order of their first state. */
export const parts: readonly Part[] = [...new Set(variants.map((variant) => variant.part))];

export const variantsOf = (wanted: Part): readonly Variant[] => variants.filter(({ part: owner }) => owner === wanted);
