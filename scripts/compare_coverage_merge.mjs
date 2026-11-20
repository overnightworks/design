// Fails when the merged component coverage counts fewer branches, or fewer covered branches, than
// the client report of Vitest, or when the lockfile holds more than one source-map remapper. nyc and
// Vitest remap with one library, so the merge keeps Vitest's entries. A merged report that counts
// more passes, because a doubled entry only adds an open arm. Equal counts can hide one arm traded
// for another, and the merge can drop browser hits for an entry that shares its first arm with
// another one; neither shows in these numbers.
import { readFileSync } from 'node:fs';

const branchesOf = (file) => JSON.parse(readFileSync(file, 'utf8')).total.branches;
const vitest = branchesOf('coverage/unit-summary.json');
const merged = branchesOf('coverage/coverage-summary.json');

// One remapper only holds if the lockfile carries one copy of the library, the fork Vitest and nyc share.
const remapperPackages = ['istanbul-lib-source-maps@', '@vitest/istanbul-lib-source-maps@'];
const remappers = new Set(
	readFileSync('pnpm-lock.yaml', 'utf8')
		.split('\n')
		.filter((line) => line.startsWith('  ') && !line.startsWith('   ') && line.endsWith(':'))
		.map((line) => line.slice(2, -1).replaceAll("'", '').split('(')[0])
		.filter((key) => remapperPackages.some((name) => key.startsWith(name)))
);

const problems = [];
if (merged.total < vitest.total) problems.push(`the merge counts ${merged.total} branches, the client report ${vitest.total}`);
if (merged.covered < vitest.covered) problems.push(`the merge covers ${merged.covered} branches, the client report ${vitest.covered}`);
if (remappers.size !== 1) problems.push(`the lockfile holds ${remappers.size} source-map remappers: ${[...remappers]}`);

if (problems.length > 0) {
	console.error(problems.join('\n'));
	process.exit(1);
}
console.log(`merged ${merged.covered}/${merged.total} branches, the client report ${vitest.covered}/${vitest.total}, one remapper ${[...remappers]}`);
