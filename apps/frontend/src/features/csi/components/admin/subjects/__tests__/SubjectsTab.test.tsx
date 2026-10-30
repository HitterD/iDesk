import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiSubjectGroup, CsiSubjectView } from '../../../../types';
import { SubjectsTab } from '../SubjectsTab';

const person = (id: string, name: string, tagline: string | null): CsiSubjectView => ({
    key: `user:${id}`, kind: 'PERSON', userId: id, teamId: null, siteId: 's1', name, jobTitle: 'IT Support', photoUrl: null, tagline,
});
const TEAM: CsiSubjectView = {
    key: 'team:t1', kind: 'TEAM', userId: null, teamId: 't1', siteId: 's1', name: 'Tim Sepanjang', jobTitle: null, photoUrl: null, tagline: 'Siap bantu',
};
const GROUPS: CsiSubjectGroup[] = [
    { siteId: 's1', siteCode: 'SPJ', siteName: 'Sepanjang', team: TEAM, people: [person('u1', 'Andi', null), person('u2', 'Budi', 'Cepat')] },
    { siteId: 's2', siteCode: 'KRW', siteName: 'Karawang', team: null, people: [] },
];

const hooks = vi.hoisted(() => ({ update: vi.fn(), upload: vi.fn(), createTeam: vi.fn() }));
vi.mock('../../../../hooks/useCsi', () => ({
    useCsiSubjects: () => ({ data: GROUPS, isLoading: false, isError: false, refetch: vi.fn() }),
    useUpdateCsiSubject: () => ({ mutate: hooks.update, isPending: false }),
    useUploadCsiSubjectPhoto: () => ({ mutate: hooks.upload, isPending: false }),
    useCreateCsiTeam: () => ({ mutate: hooks.createTeam, isPending: false }),
}));

const MB = 1024 * 1024;
const fileOfSize = (name: string, type: string, size: number) => {
    const file = new File(['x'], name, { type });
    Object.defineProperty(file, 'size', { value: size });
    return file;
};
type Actor = ReturnType<typeof userEvent.setup>;
const openCard = (actor: Actor, name: string) => actor.click(screen.getByRole('button', { name: new RegExp(`^Ubah ${name}`) }));

beforeEach(() => { hooks.update.mockReset(); hooks.upload.mockReset(); hooks.createTeam.mockReset(); });
afterEach(cleanup);

describe('SubjectsTab', () => {
    it('groups subjects by site with a missing-tagline warning', async () => {
        render(<SubjectsTab scope="ict" />);
        const spj = screen.getByRole('region', { name: 'ICT Sepanjang' });
        expect(within(spj).getByText('SPJ')).toBeInTheDocument();
        expect(within(spj).getByText('3 subjek · 1 tim · 2 individu')).toBeInTheDocument();
        expect(within(spj).getByText('1 belum ada tagline')).toBeInTheDocument();
        expect(within(spj).getByText('Tambah tagline')).toBeInTheDocument();
        expect(within(spj).getByText('“Cepat”')).toBeInTheDocument();
        expect(within(spj).queryByRole('button', { name: 'Tambah tim' })).not.toBeInTheDocument();

        const krw = screen.getByRole('region', { name: 'ICT Karawang' });
        expect(within(krw).getByText('0 subjek · 0 tim · 0 individu')).toBeInTheDocument();
        expect(within(krw).queryByText(/belum ada tagline/)).not.toBeInTheDocument();
        expect(within(krw).getByText('Belum ada anggota ICT di site ini.')).toBeInTheDocument();
        await userEvent.setup().click(within(krw).getByRole('button', { name: 'Tambah tim' }));
        expect(hooks.createTeam).toHaveBeenCalledWith({ siteId: 's2' });
    });

    it('uses scope-neutral empty copy for HC', () => {
        render(<SubjectsTab scope="hc" />);
        expect(screen.getByRole('region', { name: 'HC Karawang' })).toBeInTheDocument();
        expect(screen.getByText('Belum ada anggota di site ini.')).toBeInTheDocument();
    });

    it('typing a tagline updates the preview live', async () => {
        const actor = userEvent.setup();
        render(<SubjectsTab scope="ict" />);
        await openCard(actor, 'Andi');
        const preview = screen.getByTestId('csi-subject-photo');
        expect(within(preview).getByRole('heading', { name: 'Andi' })).toBeInTheDocument();
        expect(within(preview).queryByText(/“/)).not.toBeInTheDocument();

        await actor.type(screen.getByLabelText(/Tagline/), 'Selalu siap');
        expect(within(preview).getByText('“Selalu siap”')).toBeInTheDocument();
        expect(screen.getByText('11/90')).toBeInTheDocument();
        expect(screen.getByLabelText(/Tagline/)).toHaveAttribute('maxLength', '90');
    });

    it('rejects a 6 MB file with the size message', async () => {
        const actor = userEvent.setup();
        render(<SubjectsTab scope="ict" />);
        await openCard(actor, 'Andi');
        await actor.upload(screen.getByLabelText('Pilih foto'), fileOfSize('big.jpg', 'image/jpeg', 6 * MB));
        expect(screen.getByRole('alert')).toHaveTextContent('Ukuran foto maksimal 5 MB');

        fireEvent.drop(screen.getByRole('button', { name: /Tarik foto ke sini/ }),
            { dataTransfer: { files: [fileOfSize('doc.gif', 'image/gif', MB)] } });
        expect(screen.getByRole('alert')).toHaveTextContent('Format foto harus JPG, PNG, atau WebP');

        await actor.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(hooks.upload).not.toHaveBeenCalled();
    });

    it('saving calls the update hook with the tagline', async () => {
        const actor = userEvent.setup();
        render(<SubjectsTab scope="ict" />);
        await openCard(actor, 'Andi');
        await actor.type(screen.getByLabelText(/Tagline/), '  Selalu siap ');
        await actor.clear(screen.getByLabelText('Jabatan yang ditampilkan'));
        await actor.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(hooks.update).toHaveBeenCalledWith({ key: 'user:u1', payload: { tagline: 'Selalu siap', jobTitle: null } }, expect.anything());
        expect(screen.queryByLabelText('Nama tim')).not.toBeInTheDocument();
    });

    it('uploads a valid photo before saving and edits the team name', async () => {
        const actor = userEvent.setup();
        hooks.upload.mockImplementation((_vars: unknown, options: { onSuccess: () => void }) => options.onSuccess());
        render(<SubjectsTab scope="ict" />);
        await openCard(actor, 'Tim Sepanjang');
        await actor.clear(screen.getByLabelText('Nama tim'));
        await actor.type(screen.getByLabelText('Nama tim'), 'Tim SPJ');
        await actor.clear(screen.getByLabelText(/Tagline/));
        const file = fileOfSize('team.png', 'image/png', MB);
        await actor.upload(screen.getByLabelText('Pilih foto'), file);
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'Simpan' }));
        expect(hooks.upload).toHaveBeenCalledWith({ key: 'team:t1', file }, expect.anything());
        expect(hooks.update).toHaveBeenCalledWith({ key: 'team:t1', payload: { tagline: null, jobTitle: null, name: 'Tim SPJ' } }, expect.anything());
    });
});
