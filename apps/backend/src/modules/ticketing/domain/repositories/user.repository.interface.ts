import { User } from '@prisma/client';

export interface IUserRepository {
    findByTelegramId(telegramId: string): Promise<User | null>;
    createGuest(telegramId: string, fullName: string): Promise<User>;
}
