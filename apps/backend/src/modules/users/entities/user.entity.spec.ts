import { User } from './user.entity';

describe('User serialization', () => {
    const user = () => Object.assign(new User(), { id: 'u-1', fullName: 'Budi', email: 'b@x.id', password: '$2b$10$HASH' });

    it('never puts the password hash in JSON (HTTP responses and socket payloads)', () => {
        const json = JSON.stringify({ ticket: { messages: [{ sender: user() }] } });
        expect(json).not.toContain('$2b$10$HASH');
        expect(json).not.toContain('"password"');
        expect(json).toContain('Budi');
    });

    it('keeps the hash readable in code, for login and password changes', () => {
        expect(user().password).toBe('$2b$10$HASH');
    });
});
