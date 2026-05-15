// Re-exportación del repositorio unificado (ver src/modules/users/users.repository.ts)
export {
  createUsersRepository as createAuthRepository,
  type UsersRepository as AuthRepository,
} from "../users/users.repository";
