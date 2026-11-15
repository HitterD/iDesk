import { User } from './user.entity';

describe('User serialization', () => {
    const user = () => Object.assign(new User(), {
        id: 'u-1',
        fullName: 'Budi',
        email: 'b@x.id',
        password: '$2b$10$HASH',
        hashedRefreshToken: '$2b$10$REFRESH',
    });

    it('never puts the password hash or refresh token hash in JSON (HTTP responses and socket payloads)', () => {
        const json = JSON.stringify({ ticket: { messages: [{ sender: user() }] } });
        expect(json).not.toContain('$2b$10$HASH');
        expect(json).not.toContain('$2b$10$REFRESH');
        expect(json).not.toContain('"password"');
        expect(json).not.toContain('"hashedRefreshToken"');
        expect(json).toContain('Budi');
    });

    it('keeps the hashes readable in code, for login, password changes and token checks', () => {
        expect(user().password).toBe('$2b$10$HASH');
        expect(user().hashedRefreshToken).toBe('$2b$10$REFRESH');
    });
});
