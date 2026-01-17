export interface TestUser {
  id: string
  email: string
  token: string
}

export function authHeader(token: string) {
  return { Authorization: `Bearer ${token}` }
}
