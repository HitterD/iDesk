import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

/*
 * Ratchet. Every recommended rule is an error, except the ones the codebase still breaks today: those are warnings,
 * and CI caps the warning count (`npm run lint`, --max-warnings), so the debt can only shrink. Fixing a rule's last
 * hit: delete it here so it becomes an error again. Fixing any hit: lower --max-warnings in package.json.
 */
const EXISTING_DEBT = [
  '@typescript-eslint/no-explicit-any',
  '@typescript-eslint/no-unused-vars',
  '@typescript-eslint/ban-ts-comment',
  '@typescript-eslint/no-empty-object-type',
  '@typescript-eslint/no-unsafe-function-type',
  'react-hooks/set-state-in-effect',
  'react-hooks/refs',
  'react-hooks/immutability',
  'react-hooks/purity',
  'react-hooks/preserve-manual-memoization',
  'react-hooks/static-components',
  'no-empty',
  'no-useless-assignment',
  'no-useless-escape',
  'no-misleading-character-class',
  'no-control-regex',
  'prefer-const',
  'preserve-caught-error',
]

export default defineConfig([
  globalIgnores(['dist', 'dev-dist', 'coverage', 'public']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
    rules: Object.fromEntries(EXISTING_DEBT.map((rule) => [rule, 'warn'])),
  },
])
