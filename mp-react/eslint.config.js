// Configuração do ESLint 9 (flat config) — padrão Vite + React
import js from '@eslint/js'
import globals from 'globals'
import react from 'eslint-plugin-react'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'

export default [
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    files: ['**/*.{js,jsx}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser, ...globals.node },
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      // sem esta regra, componentes usados apenas no JSX
      // seriam marcados como "não usados" pelo no-unused-vars
      'react/jsx-uses-vars': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      // variáveis não usadas: aviso (não erro) e ignora args iniciados com _
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrors: 'none' }],
      // catch vazio é usado de propósito no projeto (falhas silenciosas)
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  // Service worker (public/) roda em outro ambiente: self, clients etc.
  {
    files: ['public/**/*.js'],
    languageOptions: { globals: { ...globals.serviceworker } },
  },
  // LoginPage é aberta pela extensão do navegador e usa a API chrome.*
  {
    files: ['src/pages/LoginPage.jsx'],
    languageOptions: { globals: { ...globals.webextensions } },
  },
]
