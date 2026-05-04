import { describe, it, expect } from 'vitest'
import { renderWithProviders } from './renderWithProviders'
import { createFirebaseMocks } from './mockFirebase'

describe('Infraestrutura de testes', () => {
  it('works', () => {
    expect(1 + 1).toBe(2)
  })

  it('createFirebaseMocks retorna vi.fn() frescos', () => {
    const mocks = createFirebaseMocks()
    expect(typeof mocks.getDocs).toBe('function')
    expect(typeof mocks.onAuthStateChanged).toBe('function')
  })

  it('renderWithProviders não lança erros com componente vazio', () => {
    const Vazio = () => <div data-testid='vazio'>ok</div>
    const { getByTestId } = renderWithProviders(<Vazio />)
    expect(getByTestId('vazio')).toBeInTheDocument()
  })
})
