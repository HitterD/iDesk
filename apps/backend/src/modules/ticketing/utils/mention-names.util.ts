import { EntityManager, In } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { mentionedIn, ThreadMessage } from './message-presenter.util';

/** Names of everyone the given messages mention, in one query (id → full name). */
export async function loadMentionNames(manager: Pick<EntityManager, 'find'>, messages: ThreadMessage[]): Promise<Map<string, string>> {
    const ids = mentionedIn(messages);
    if (ids.length === 0) return new Map();
    const users = await manager.find(User, { where: { id: In(ids) }, select: ['id', 'fullName'] });
    return new Map(users.map((u) => [u.id, u.fullName]));
}
