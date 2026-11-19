# design

## Commands

- `pnpm run` lists the package scripts. design has no other task runner.
- `pnpm exec vitest run <file>`: one Vitest file of `src/lib`. Needs `pnpm install --frozen-lockfile`.
- `pnpm run test:coverage`: Vitest with Istanbul counters, its JSON report in `coverage/remapped` and its summary in `coverage/unit-summary.json`. Needs `pnpm install --frozen-lockfile`.
- `pnpm run check`: the Svelte and TypeScript type check. Needs `pnpm install --frozen-lockfile`.
- `uv run --frozen --extra catalogs pytest -q tests/<module>.py -k <behaviour>`: one Python module; `--extra catalogs` installs Babel for `tests/catalogs`. `tests/test_npm_package.py`, `tests/catalogs/test_typescript_type_check.py` and `tests/catalogs/test_python_module_type_check.py` need `pnpm install --frozen-lockfile` first. CI adds `--cov --cov-branch --cov-fail-under=100`.
- `uv run --frozen --extra catalogs design-catalogs --check`: the kit's own catalogs in `src/catalogs` against `src/lib/words` and `src/design/words.py`; plain `design-catalogs` regenerates them after a catalog change.
- `uv run --frozen ruff check .` and `uv run --frozen ruff format --check .`: Python lint; both must pass.
- `quality check`: the shared static check. Run it at the release `.github/workflows/ci.yml` pins.
- `pnpm run test:consumer`: the Playwright consumers, a probe stack. Run it only through `probe-run`, as the global contract's section "Machine load and local runs" says; the consumers serve a routed origin and bind no host port, so lanes may drive in parallel. It clears `coverage/drive` and leaves the browser's counters there.
- `pnpm run coverage:merge`: remaps the browser counters onto `src/lib`, merges them with Vitest's and writes `coverage/lcov.info` and a text table, then fails when the merge counts fewer branches than Vitest or the lockfile holds two source-map remappers. Run it after `test:coverage` and the consumer drive.
- `gh workflow run release.yml -R overnightworks/design -f version=X.Y.Z`: the release dispatch, an agent's step once the version pull request has landed with its review and CI green. `main` must carry X.Y.Z in `pyproject.toml` and `package.json`.

## Rules

- After the release run, the head replaces GitHub's generated release notes, below the hashes, with the version's notes: what changed, the breaking changes and the upgrade steps.

## Documents

- `README.md`: read when you need to use the kit or see how it is distributed and released.
- `docs/VISION.md`: read when you need to know what design is for and whom it serves.
- `docs/ARCHITECTURE.md`: read when you change the parts, the build or the release path.
- `docs/stylesheet.md`: read when writing markup against `design.css` or the components.
- `docs/languages.md`: read when you build or judge an app's languages, or the kit's words.
