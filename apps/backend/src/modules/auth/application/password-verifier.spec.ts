import * as bcrypt from 'bcrypt';
import { DUMMY_PASSWORD_HASH, verifyPassword } from './password-verifier';

jest.mock('bcrypt');

describe('verifyPassword', () => {
    it('uses fixed dummy hash when stored hash is missing', async () => {
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);

        await expect(verifyPassword('password')).resolves.toBe(true);

        expect(bcrypt.compare).toHaveBeenCalledWith('password', DUMMY_PASSWORD_HASH);
    });

    it('uses stored hash when available', async () => {
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(verifyPassword('password', 'stored-hash')).resolves.toBe(false);

        expect(bcrypt.compare).toHaveBeenCalledWith('password', 'stored-hash');
    });
});

afterEach(() => jest.clearAllMocks());

beforeEach(() => jest.clearAllMocks());
