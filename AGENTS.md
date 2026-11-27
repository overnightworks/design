# design

## Commands

- `pnpm run` lists the package scripts. design has no other task runner.
- `pnpm exec vitest run <file>`: one Vitest file of `src/lib`. Needs `pnpm install --frozen-lockfile`.
- `pnpm run check`: the Svelte and TypeScript type check. Needs `pnpm install --frozen-lockfile`.
- `uv run --frozen --extra catalogs pytest -q tests/<module>.py -k <behaviour>`: one Python module; `--extra catalogs` installs Babel for `tests/catalogs`. `tests/e2e/test_npm_package.py`, `tests/catalogs/test_typescript_type_check.py` and `tests/catalogs/test_python_module_type_check.py` need `pnpm install --frozen-lockfile` first. CI adds `--cov --cov-branch --cov-fail-under=100`.
- `uv run --frozen --extra catalogs design-catalogs --check`: the kit's own catalogs in `src/catalogs` against `src/lib/words` and `src/design/words.py`; plain `design-catalogs` regenerates them after a catalog change.
- `uv run --frozen ruff check .` and `uv run --frozen ruff format --check .`: Python lint; both must pass.
- `quality check`: the shared static check. Run it at the release `.github/workflows/ci.yml` pins.
- `pnpm run build:parts-page`: builds the parts page, one page per part and kit language, from the packed tarball into `tests/e2e/.parts-page`. `pnpm run test:consumer` reads it and fails without it, so run this first.
- `pnpm run open:parts-page`: builds the parts page from a tarball packed from the checkout, serves it on `127.0.0.1` and prints the link; runs until interrupted.
- `pnpm run test:consumer <spec>`: the named Playwright consumer specs of `tests/e2e`, a probe stack. Run it only through `probe-run`, as the global contract's section "Machine load and local runs" says; the consumers serve a routed origin and bind no host port, so lanes may drive in parallel.
- `pnpm run test:coverage`, the whole consumer suite and `pnpm run coverage:merge` run in CI on the pushed branch, not locally; `docs/ARCHITECTURE.md` says what the merge fails on.
- `gh workflow run release.yml -R overnightworks/design -f version=X.Y.Z`: the release dispatch, an agent's step once the version pull request has landed with its review and CI green. `main` must carry X.Y.Z in `pyproject.toml` and `package.json`.

## Rules

- After the release run, the head replaces GitHub's generated release notes, below the hashes, with the version's notes: what changed, the breaking changes and the upgrade steps.

## Documents

- `README.md`: read when you need to use the kit or see how it is distributed and released.
- `docs/VISION.md`: read when you need to know what design is for and whom it serves.
- `docs/ARCHITECTURE.md`: read when you change the parts, the build or the release path.
- `docs/stylesheet.md`: read when writing markup against `design.css` or the components.
- `docs/languages.md`: read when you build or judge an app's languages, or the kit's words.
