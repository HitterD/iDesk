import { User } from '../../../users/entities/user.entity';

export interface IUserRepository {
    findByTelegramId(telegramId: string): Promise<User | null>;
    createGuest(telegramId: string, fullName: string): Promise<User>;
}
