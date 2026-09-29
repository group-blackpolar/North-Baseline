// Platform users returned by CoreCrow GET /v1/users.
export interface ApiUser {
  id: string
  email: string
  name: string | null
  role: 'USER' | 'DEVELOPER' | 'ADMIN' | 'SUPERADMIN'
  emailVerified: boolean
  createdAt: string
}
