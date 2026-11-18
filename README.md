# design

The family look that overnightworks products share (tokens, fonts, the heading
rule, two classes and ten Svelte components), for the engineers of those products.

## Quick start

Distribution is a GitHub release. It carries:

- the wheel `overnightworks_design-<version>-py3-none-any.whl` (import `design`):
  `design/static/design.css` and `design/static/fonts/`, the command
  `design-catalogs` and the kit's Python words;
- `overnightworks-design-<version>.tgz`: the same stylesheet and fonts, plus the
  [components](#components) and the kit's words per language. It is the only npm
  distribution, and `svelte` ^5.20 is its only, peer, dependency;
- `design-<version>-tokens.txt`: the sorted custom-property names `design.css`
  defines.

An app that takes the stylesheet and fonts through Python (platform copies them
into its Keycloak themes and legal pages) pins the wheel by URL with its hash,
which the release notes give:

```
https://github.com/overnightworks/design/releases/download/v<version>/overnightworks_design-<version>-py3-none-any.whl#sha256=<sha256>
```

A SvelteKit app pins the tarball by URL. The lockfile entry carries the
tarball's `sha512-` integrity: pnpm 12 refuses an entry without it at every
install, frozen or not (`ERR_PNPM_MISSING_TARBALL_INTEGRITY`), and fails on a
mismatch ([pnpm 11.4.0](https://github.com/pnpm/pnpm/releases/tag/v11.4.0)).
Compare the lockfile's value with the one at the top of the release notes, or
enter that one:

```
https://github.com/overnightworks/design/releases/download/v<version>/overnightworks-design-<version>.tgz
```

Then `import 'overnightworks-design/design.css'` and
`import { SignInPage } from 'overnightworks-design'`.

## Components

Each component's props and behaviour are documented in
[`src/lib/types.ts`](src/lib/types.ts); its words and what it leaves to the app
are in the [stylesheet reference](docs/stylesheet.md). The app owns the trigger,
the popover, the network and every decision about its product.

| Component | What it draws |
| --- | --- |
| `SignInPage` | the sign-in page in its five states: signed out, signing in (in a separate window), window blocked, login failed and no access |
| `AccountMenu` | the account panel for an app's popover |
| `LegalLinks` | the legal row, which `SignInPage` and `AccountMenu` draw themselves; for a page without the account menu |
| `AgentControl` | the panel of rows with which a person calls an agent into a place and asks it to leave |
| `HearingSwitch` | one chip with a switch for an agent's hearing or sight (`hear`, `listen`, `see`), drawn on a video |
| `EarMark` | the round ear with the agent's name that shows an agent hears a person, drawn on a video |
| `TurnState` | the muted mark and word for the reason an agent's turns do not answer; nothing without an outcome |
| `HelperChat` | the conversation with an app's helper agent, from props alone |
| `Marked` | the list of parts of a marked sentence, in place and with no element of its own |
| `AiMark` | the "AI" pill before an agent's name; it takes no props and no words |

Every component except `Marked` and `AiMark` takes the kit's words as the required
prop `words`, loaded with `loadKitWords` for the page's language; none holds an
English default or reads a language. [Languages](docs/languages.md#the-kits-words-in-an-app)
shows how an app loads them.

```svelte
<SignInPage
	appName="Hallucinai"
	state={{ page: 'signed-out', signInHref }}
	{legalLinks}
	words={kitWords}
/>
```

`Marked` renders a sentence that `design-catalogs` generated with a marked part;
the app gives one snippet per marker name:

```svelte
<script lang="ts">
  import { Marked } from 'overnightworks-design';
  import { words } from './words/de';

  const parts = words['retention.archiveConfirm']({ count: 3, deleted: '2' });
</script>

{#snippet strong({ text }: { text: string })}<strong>{text}</strong>{/snippet}
{#snippet help({ text }: { text: string })}<a href="/help">{text}</a>{/snippet}

<p><Marked {parts} marked={{ strong, help }} /></p>
```

## Catalogs

`design-catalogs` turns an app's gettext catalogs into typed TypeScript and
Python modules, so that a further language means adding a catalog file, not
changing code. It is in the wheel only, behind the extra `catalogs` (which
requires `po`, the extra that carries Babel); an app that takes the wheel for
`design.css` gets no Babel. `design-catalogs --check` gates the modules in the
app's lint and CI, and `--sync` brings the translations in line with the source.
The pins, the commands, the declaration table, the generated modules and the
rules `--check` holds are in [Languages](docs/languages.md#using-the-generator).

`design.catalogs` also has two pure functions, `catalog_directory` and
`parse_catalog`, for a tool that reads catalogs exactly as the command does;
[Languages](docs/languages.md#reading-catalogs-from-python) gives their contracts.

## Documentation

- [Vision](docs/VISION.md): what design is for and what it is not.
- [Stylesheet reference](docs/stylesheet.md): the classes, tokens, wording and
  legal-row markup.
- [Architecture](docs/ARCHITECTURE.md): the parts, the trust and the proof.
- [Languages](docs/languages.md): the fleet standard for building apps so that a
  further language needs no code change, and the generator's use.

## Release

A release is dispatched with the version alone and passes quality's release gate
before it builds the wheel and the tarball, tags `main` and attaches both and the
token list to a GitHub release. The release notes carry the hashes for the pins.
The dispatch command and the repository's targeted checks are in
[AGENTS.md](AGENTS.md).

## Licence

[MIT](LICENSE). The fonts keep their OFL licences, shipped beside them.
