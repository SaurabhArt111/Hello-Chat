import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      react,
    },
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
      // Without this, no-unused-vars can't see that a variable (e.g. an
      // icon component or `motion` from framer-motion) is used only via a
      // JSX tag like <Icon/> or <motion.div/>, and false-flags it as unused.
      'react/jsx-uses-vars': 'error',

      // eslint-plugin-react-hooks v7's "recommended" preset ships a batch of
      // new React-Compiler-readiness rules as hard errors. They're aimed at
      // codebases opting into the React Compiler, and some of them (e.g.
      // immutability) flag textbook-correct code, such as setting a ref's
      // .current inside a useEffect. Since this app doesn't use the React
      // Compiler, keep these as warnings - useful signal, not a build-blocker.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/set-state-in-render': 'warn',
      'react-hooks/error-boundaries': 'warn',
      'react-hooks/static-components': 'warn',
      'react-hooks/use-memo': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      'react-hooks/globals': 'warn',
      'react-hooks/config': 'warn',
      'react-hooks/gating': 'warn',

      // DX-only (Fast Refresh/HMR granularity for files that export both a
      // component and a hook/constant, e.g. context providers) - not a bug.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
