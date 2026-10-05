// CI-only Jest config: same as package.json "jest", but ts-jest skips per-file type
// checking (tsc --noEmit already runs as its own CI step). Type-checking every spec
// made the suite take ~14 s per file and exhaust the runner's memory.
const base = require('./package.json').jest;

module.exports = {
    ...base,
    transform: {
        '^.+\.(t|j)s$': ['ts-jest', { isolatedModules: true, diagnostics: false }],
    },
};
