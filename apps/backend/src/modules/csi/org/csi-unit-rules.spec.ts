import { CsiOrgLocation } from './csi-org.constants';
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
