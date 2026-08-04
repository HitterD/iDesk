/**
 * @deprecated Persistence roles live in `modules/users/enums/user-role.enum.ts`.
 * Keep this module as a type-only compatibility surface until callers migrate.
 */
export type { UserRole } from '../../users/enums/user-role.enum';

/**
 * @deprecated Use `modules/users/entities/user.entity.ts` for persistence data.
 */
export type { User } from '../../users/entities/user.entity';
