import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { strToU8, zipSync } from 'fflate';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsiSubjectGroup, CsiSubjectView } from '../../../../types';
import { SubjectsTab } from '../SubjectsTab';

const base = { userId: null, teamId: null, siteId: 's1', jobTitle: null, photoUrl: null, tagline: null, serviceFunction: null, teamKind: null, serviceCode: null, picId: null, hasAccount: true } as const;
const PIC_NO_ACCOUNT: CsiSubjectView = { ...base, key: 'pic:p1', kind: 'PERSON', picId: 'p1', name: 'Rara Kurnia', serviceCode: 'HCD', hasAccount: false };
const PERSON: CsiSubjectView = { ...base, key: 'user:u1', kind: 'PERSON', userId: 'u1', name: 'Andi Wijaya' };
const CUSTOM: CsiSubjectView = {
    ...base, key: 'team:t5', kind: 'TEAM', teamId: 't5', name: 'Tim Payroll', teamKind: 'CUSTOM', serviceCode: 'HCC', hasAccount: false,
    members: [{ id: 'm1', name: 'Joko', userId: null }, { id: 'm2', name: 'Andi Wijaya', userId: 'u1' }],
};
const GROUPS: CsiSubjectGroup[] = [
    { siteId: 's1', siteCode: 'KRW', siteName: 'Karawang', team: null, teams: [CUSTOM], people: [PIC_NO_ACCOUNT, PERSON] },
    { siteId: 's2', siteCode: 'SMG', siteName: 'Semarang', team: null, teams: [], people: [] },
];

const hooks = vi.hoisted(() => ({
    upload: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn(), setMembers: vi.fn(),
}));
const pending = { isPending: false };
vi.mock('../../../../hooks/useCsi', () => ({
    useAddCsiSubjectMembers: () => ({ mutate: vi.fn(), ...pending }),
    useRemoveCsiSubjectMember: () => ({ mutate: vi.fn(), ...pending }),
    useCsiUserSearch: () => ({ data: [{ id: 'hc9', fullName: 'Hana HC', email: 'h@x', jobTitle: 'HC Officer', siteId: 's1', site: { code: 'KRW', name: 'Karawang' } }], isFetching: false }),
    useCsiSubjects: () => ({ data: GROUPS, isLoading: false, isError: false, refetch: vi.fn() }),
    useUpdateCsiSubject: () => ({ mutate: vi.fn(), ...pending }),
    useUploadCsiSubjectPhoto: () => ({ mutate: vi.fn(), mutateAsync: hooks.upload, ...pending }),
    useCreateCsiTeam: () => ({ mutate: vi.fn(), ...pending }),
}));
vi.mock('../../../../hooks/useCsiHc', () => ({
    useCreateCustomTeam: () => ({ mutateAsync: hooks.create, ...pending }),
    useUpdateCustomTeam: () => ({ mutateAsync: hooks.update, ...pending }),
    useDeleteCustomTeam: () => ({ mutateAsync: hooks.remove, ...pending }),
    useSetCustomTeamMembers: () => ({ mutateAsync: hooks.setMembers, ...pending }),
}));

const photo = (name: string) => new File(['x'], name, { type: 'image/jpeg' });

beforeEach(() => {
    Object.values(hooks).forEach((fn) => fn.mockReset());
    hooks.create.mockResolvedValue({ ...CUSTOM, key: 'team:t9', teamId: 't9' });
    hooks.update.mockResolvedValue(CUSTOM);
    hooks.setMembers.mockResolvedValue(CUSTOM);
    hooks.remove.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe('SubjectsTab (HC)', () => {
    it('PIC without account shows badge', () => {
        render(<SubjectsTab scope="hc" />);
        expect(screen.getByText('Orang yang dinilai')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: /^Ubah Rara Kurnia/ })).getByText('Belum punya akun')).toBeInTheDocument();
        expect(within(screen.getByRole('button', { name: /^Ubah Andi Wijaya/ })).queryByText('Belum punya akun')).not.toBeInTheDocument();
        const team = screen.getByRole('button', { name: /^Ubah Tim Payroll/ });
        expect(within(team).getByText('HCC')).toBeInTheDocument();
        expect(within(team).getByText('2 anggota')).toBeInTheDocument();
        expect(within(screen.getByRole('region', { name: 'HC Semarang' }))
            .getByText('Belum ada orang di site ini. Impor template lokasi ini di Template penugasan.')).toBeInTheDocument();
    });

    it('Impor Excel opens the template section and "tambah manual" reveals the member search', async () => {
        const actor = userEvent.setup();
        const onOpenTemplates = vi.fn();
        render(<SubjectsTab scope="hc" onOpenTemplates={onOpenTemplates} />);
        await actor.click(screen.getByRole('button', { name: /Impor Excel/ }));
        expect(onOpenTemplates).toHaveBeenCalled();
        expect(screen.queryByRole('button', { name: 'Pilih anggota' })).not.toBeInTheDocument();
        await actor.click(screen.getByRole('button', { name: 'tambah manual' }));
        expect(screen.getByRole('button', { name: 'Pilih anggota' })).toBeInTheDocument();
    });

    it('custom team sheet requires service', async () => {
        const actor = userEvent.setup();
        render(<SubjectsTab scope="hc" />);
        await actor.click(screen.getByRole('button', { name: /Tim custom/ }));
        const sheet = screen.getByRole('dialog');
        await actor.type(within(sheet).getByLabelText('Nama tim'), 'Tim Rekrut');
        await actor.type(within(sheet).getByRole('combobox', { name: 'Tambah anggota' }), 'Joko Susilo{Enter}');
        await actor.type(within(sheet).getByRole('combobox', { name: 'Tambah anggota' }), 'Ha');
        await actor.click(await within(sheet).findByRole('option', { name: /Hana HC/ }));
        expect(within(sheet).getByRole('button', { name: 'Simpan' })).toBeDisabled();
        expect(within(sheet).getByText('Pilih layanan tim.')).toBeInTheDocument();

        await actor.selectOptions(within(sheet).getByLabelText('Layanan'), 'HCS');
        await actor.click(within(sheet).getByRole('button', { name: 'Simpan' }));
        await waitFor(() => expect(hooks.setMembers).toHaveBeenCalled());
        expect(hooks.create).toHaveBeenCalledWith({ siteId: 's1', name: 'Tim Rekrut', serviceCode: 'HCS' });
        expect(hooks.setMembers).toHaveBeenCalledWith({ id: 't9', members: [{ name: 'Joko Susilo' }, { userId: 'hc9' }] });
    });

    it('a failed member save after create retries as an update, not a second create', async () => {
        const actor = userEvent.setup();
        hooks.setMembers.mockRejectedValueOnce({ response: { status: 400, data: { message: 'Anggota tidak valid' } } });
        render(<SubjectsTab scope="hc" />);
        await actor.click(screen.getByRole('button', { name: /Tim custom/ }));
        const sheet = screen.getByRole('dialog');
        await actor.type(within(sheet).getByLabelText('Nama tim'), 'Tim Rekrut');
        await actor.selectOptions(within(sheet).getByLabelText('Layanan'), 'HCD');
        await actor.click(within(sheet).getByRole('button', { name: 'Simpan' }));
        expect(await within(sheet).findByText('Anggota tidak valid')).toBeInTheDocument();
        expect(within(sheet).getByLabelText('Site')).toBeDisabled();

        await actor.click(within(sheet).getByRole('button', { name: 'Simpan' }));
        await waitFor(() => expect(hooks.setMembers).toHaveBeenCalledTimes(2));
        expect(hooks.create).toHaveBeenCalledTimes(1);
        expect(hooks.update).toHaveBeenCalledWith({ id: 't9', name: 'Tim Rekrut', serviceCode: 'HCD' });
        expect(hooks.setMembers).toHaveBeenLastCalledWith({ id: 't9', members: [] });
    });

    it('editing a custom team locks the site and shows the backend refusal on delete', async () => {
        const actor = userEvent.setup();
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        hooks.remove.mockRejectedValue({ response: { status: 400, data: { message: 'Tim dipakai di survei yang belum selesai' } } });
        render(<SubjectsTab scope="hc" />);
        await actor.click(screen.getByRole('button', { name: /^Ubah Tim Payroll/ }));
        const sheet = screen.getByRole('dialog');
        expect(within(sheet).getByLabelText('Site')).toBeDisabled();
        expect(within(sheet).getByLabelText('Nama tim')).toHaveValue('Tim Payroll');
        await actor.click(within(sheet).getByRole('button', { name: 'Hapus Joko dari tim' }));
        await actor.click(within(sheet).getByRole('button', { name: 'Simpan' }));
        await waitFor(() => expect(hooks.setMembers).toHaveBeenCalledWith({ id: 't5', members: [{ userId: 'u1' }] }));
        expect(hooks.update).toHaveBeenCalledWith({ id: 't5', name: 'Tim Payroll', serviceCode: 'HCC' });

        await actor.click(screen.getByRole('button', { name: /^Ubah Tim Payroll/ }));
        await actor.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Hapus tim/ }));
        expect(await screen.findByText('Tim dipakai di survei yang belum selesai')).toBeInTheDocument();
        expect(hooks.remove).toHaveBeenCalledWith('t5');
    });

    it('bulk dialog uploads matched files', async () => {
        const actor = userEvent.setup();
        hooks.upload.mockImplementation(async ({ key }: { key: string }) => {
            if (key === 'team:t5') throw { response: { data: { message: 'Format foto tidak didukung' } } };
            return {};
        });
        render(<SubjectsTab scope="hc" />);
        await actor.click(screen.getByRole('button', { name: /Unggah foto massal/ }));
        const dialog = screen.getByRole('dialog');
        await actor.upload(within(dialog).getByLabelText('Pilih foto atau ZIP'), [photo('rara_kurnia.jpg'), photo('payroll.jpg'), photo('lain.jpg')]);
        const rara = await within(dialog).findByLabelText('Subjek untuk rara_kurnia.jpg');
        expect(rara).toHaveValue('pic:p1');
        expect(within(dialog).getByLabelText('Subjek untuk payroll.jpg')).toHaveValue('');
        await actor.selectOptions(within(dialog).getByLabelText('Subjek untuk payroll.jpg'), 'team:t5');

        await actor.click(within(dialog).getByRole('button', { name: /Unggah 2 foto/ }));
        expect(await within(dialog).findByText(/1 foto terunggah, 1 gagal/)).toBeInTheDocument();
        expect(within(dialog).getByText('2 / 2')).toBeInTheDocument();
        expect(hooks.upload.mock.calls.map(([vars]) => vars.key)).toEqual(['pic:p1', 'team:t5']);
        expect(hooks.upload.mock.calls[0][0].file.name).toBe('rara_kurnia.jpg');
        expect(within(dialog).getByText('Format foto tidak didukung')).toBeInTheDocument();
    });

    it('a ZIP still unpacking when the dialog closes does not reappear', async () => {
        const actor = userEvent.setup();
        const zip = new File([zipSync({ 'Rara Kurnia.jpg': strToU8('x') })], 'foto.zip', { type: 'application/zip' });
        let release: () => void = () => undefined;
        const buffer = zip.arrayBuffer();
        vi.spyOn(zip, 'arrayBuffer').mockReturnValue(new Promise((resolve) => { release = () => resolve(buffer); }));
        render(<SubjectsTab scope="hc" />);
        await actor.click(screen.getByRole('button', { name: /Unggah foto massal/ }));
        await actor.upload(within(screen.getByRole('dialog')).getByLabelText('Pilih foto atau ZIP'), zip);
        await actor.click(within(screen.getByRole('dialog')).getAllByRole('button', { name: 'Tutup' }).at(-1)!);
        await actor.click(screen.getByRole('button', { name: /Unggah foto massal/ }));
        await act(async () => { release(); await buffer; });
        expect(within(screen.getByRole('dialog')).queryByRole('table')).not.toBeInTheDocument();
    });
});
