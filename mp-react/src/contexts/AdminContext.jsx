import { createContext, useContext } from 'react'

export const AdminContext = createContext(null)

export function useAdminContext() {
  const ctx = useContext(AdminContext)
  if (!ctx) throw new Error('useAdminContext must be used within AdminPage')
  return ctx
}
