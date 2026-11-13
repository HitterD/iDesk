import { BadRequestException } from '@nestjs/common';
import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { CsiOrgLocation } from './csi-org.constants';
import { CsiUnitRulesService } from './csi-unit-rules.service';
import { expandRules, personMatches, targetPics } from './csi-unit-rules';

const people = [
    { nik: '1', division: 'OPERATION SJA 1', department: 'PPIC', bagian: 'FGW', workLocation: 'SJA-1' },
    { nik: '2', division: 'OPERATION SJA 1', department: 'QUALITY CONTROL', bagian: 'QC AB REGULER', workLocation: 'SJA-1' },
    { nik: '3', division: 'MARKETING', department: 'BRAND', bagian: 'BRAND', workLocation: 'SJA-JAKARTA' },
];
const pics = [
    { periodRateeId: 'r-pay', picId: 'p-pay', serviceCode: 'HCC', bagian: 'PAYROLL & BENEFIT' },
    { periodRateeId: 'r-ret', picId: 'p-ret', serviceCode: 'HCC', bagian: 'RETIREMENT' },
    { periodRateeId: 'r-ga', picId: 'p-ga', serviceCode: 'HCS', bagian: 'GA MANAGEMENT' },
];

describe('CSI unit rules', () => {
    it('matches a unit by division and the optional department / bagian / location', () => {
        expect(personMatches({ division: 'operation sja 1', serviceCode: 'HCC' }, people[0])).toBe(true);
        expect(personMatches({ division: 'OPERATION SJA 1', department: 'PPIC', serviceCode: 'HCC' }, people[1])).toBe(false);
        expect(personMatches({ division: 'MARKETING', location: CsiOrgLocation.JKT, serviceCode: 'HCC' }, people[2])).toBe(true);
        expect(personMatches({ division: 'MARKETING', location: CsiOrgLocation.SJA1, serviceCode: 'HCC' }, people[2])).toBe(false);
    });

    it('targets a layanan, optionally one bagian or listed PICs', () => {
        expect(targetPics({ division: 'X', serviceCode: 'HCC' }, pics).map((pic) => pic.periodRateeId)).toEqual(['r-pay', 'r-ret']);
        expect(targetPics({ division: 'X', serviceCode: 'HCC', picBagian: 'RETIREMENT' }, pics).map((pic) => pic.periodRateeId)).toEqual(['r-ret']);
        expect(targetPics({ division: 'X', serviceCode: 'HCC', picIds: ['p-pay'] }, pics).map((pic) => pic.periodRateeId)).toEqual(['r-pay']);
    });

    it('merges every rule into NIK → ratees', () => {
        const result = expandRules([
            { division: 'OPERATION SJA 1', serviceCode: 'HCC', picBagian: 'PAYROLL & BENEFIT' },
            { division: 'OPERATION SJA 1', department: 'PPIC', serviceCode: 'HCS' },
            { division: 'MARKETING', serviceCode: 'HCD' }, // no HCD PIC in the period: no rater
        ], people, pics);
        expect([...result.keys()].sort()).toEqual(['1', '2']);
        expect([...result.get('1')!].sort()).toEqual(['r-ga', 'r-pay']);
        expect([...result.get('2')!]).toEqual(['r-pay']);
    });
});

describe('CsiUnitRulesService.setRater', () => {
    function buildService(ratees: Array<{ id: string; userId: string | null; picId: string | null }>) {
        const savedPairs: any[] = [];
        const manager: any = {
            getRepository: jest.fn(() => ({
                findOne: jest.fn().mockResolvedValue({ id: 'pr-1', periodId: 'p-1', userId: 'u-1' }),
                count: jest.fn().mockResolvedValue(0),
                createQueryBuilder: jest.fn(() => ({
                    setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
                    getOne: jest.fn().mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC }),
                })),
            })),
            delete: jest.fn(),
            save: jest.fn(async (_entity: any, rows: any) => { if (Array.isArray(rows)) savedPairs.push(...rows); return rows; }),
            update: jest.fn(),
            findOne: jest.fn().mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC }),
            createQueryBuilder: jest.fn(() => ({
                setLock: jest.fn().mockReturnThis(), where: jest.fn().mockReturnThis(),
                getOne: jest.fn().mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC }),
            })),
        };
        const periods = { findOne: jest.fn().mockResolvedValue({ id: 'p-1', scope: ServiceScope.HC }) };
        const users = { findOne: jest.fn().mockResolvedValue({ id: 'u-1', isActive: true }) };
        const rateeRepo = { find: jest.fn().mockResolvedValue(ratees) };
        const emptyRepo = { find: jest.fn().mockResolvedValue([]) };
        const dataSource: any = {
            transaction: jest.fn((fn: any) => fn(manager)),
            getRepository: jest.fn(() => emptyRepo),
        };
        const service = new CsiUnitRulesService(periods as any, emptyRepo as any, users as any, rateeRepo as any, dataSource);
        jest.spyOn(service, 'raterList').mockResolvedValue([]);
        return { service, rateeRepo, savedPairs };
    }

    it('allows non-PIC subjects (e.g. custom teams) without rejecting with PIC-only error', async () => {
        const { service, rateeRepo, savedPairs } = buildService([
            { id: 'r-team', userId: null, picId: null },
            { id: 'r-pic', userId: 'u-other', picId: 'pic-1' },
        ]);
        await service.setRater(ServiceScope.HC, 'p-1', 'u-1', ['r-team', 'r-pic']);
        expect(rateeRepo.find).toHaveBeenCalledWith(expect.objectContaining({
            where: expect.not.objectContaining({ picId: expect.anything() }),
        }));
        expect(savedPairs.map((pair) => pair.periodRateeId)).toEqual(['r-team', 'r-pic']);
    });

    it('rejects self-rating when a selected subject belongs to the rater', async () => {
        const { service } = buildService([{ id: 'r-self', userId: 'u-1', picId: 'pic-1' }]);
        await expect(service.setRater(ServiceScope.HC, 'p-1', 'u-1', ['r-self'])).rejects.toThrow(BadRequestException);
    });
});
