import '@testing-library/jest-dom/vitest'
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'

// Desmonta componentes renderizados após cada teste.
// Previne vazamento de estado entre testes e warnings de act().
afterEach(cleanup)
