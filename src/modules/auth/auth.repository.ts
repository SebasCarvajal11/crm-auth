// Re-exportación del repositorio unificado (ver src/modules/users/users.repository.ts)
export {
  usersRepository as authRepository,
  type UsersRepository as AuthRepository,
} from "../users/users.repository";
