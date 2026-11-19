// Fails when the merged component coverage counts fewer branches, or fewer covered branches, than
// Vitest's own report, or when the lockfile holds more than one source-map remapper. nyc and Vitest
// remap with one library, so the merge keeps Vitest's entries. A merged report that counts more
// passes, because a doubled entry only adds an open arm. Equal counts can hide one arm traded for
// another, and the merge can drop browser hits for an entry that shares its first arm with another
// one (the nested `{:else if}`s of AgentControl, line 87); neither shows in these numbers.
import { readFileSync } from 'node:fs';

const branchesOf = (file) => JSON.parse(readFileSync(file, 'utf8')).total.branches;
const vitest = branchesOf('coverage/unit-summary.json');
const merged = branchesOf('coverage/coverage-summary.json');

// One remapper only holds if the lockfile carries one copy of the library, the fork Vitest and nyc share.
const remappers = new Set(
	[...readFileSync('pnpm-lock.yaml', 'utf8').matchAll(/^ {2}'?((?:@vitest\/)?istanbul-lib-source-maps@[^':(]+)[^:]*:/gm)].map(
		(match) => match[1]
	)
);

const problems = [];
if (merged.total < vitest.total) problems.push(`the merge counts ${merged.total} branches, Vitest ${vitest.total}`);
if (merged.covered < vitest.covered) problems.push(`the merge covers ${merged.covered} branches, Vitest ${vitest.covered}`);
if (remappers.size !== 1) problems.push(`the lockfile holds ${remappers.size} source-map remappers: ${[...remappers]}`);

if (problems.length > 0) {
	console.error(problems.join('\n'));
	process.exit(1);
}
console.log(`merged ${merged.covered}/${merged.total} branches, Vitest ${vitest.covered}/${vitest.total}, one remapper ${[...remappers]}`);
