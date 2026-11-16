import { ServiceScope } from '../../../shared/core/utils/service-scope.util';
import { delegatedSiteCodeMap, mergeHandledSites } from './csi-site-merge.util';

const SPJ = { siteId: 'spj', site: { code: 'SPJ', name: 'Sepanjang', handledBySiteId: null } };
const SKD = { siteId: 'skd', site: { code: 'SKD', name: 'Sukodono', handledBySiteId: 'spj' } };
const KRW = { siteId: 'krw', site: { code: 'KRW', name: 'Karawang', handledBySiteId: null } };

describe('mergeHandledSites', () => {
    it('merges SKD into SPJ on ICT when both sites are in the period', () => {
        const merged = mergeHandledSites(ServiceScope.ICT, [KRW, SKD, SPJ]);
        expect(merged).toEqual([
            { id: 'krw', code: 'KRW', name: 'Karawang', sourceSiteIds: ['krw'], handledCodes: [] },
            { id: 'spj', code: 'SPJ', name: 'Sepanjang (+ SKD)', sourceSiteIds: ['spj', 'skd'], handledCodes: ['SKD'] },
        ]);
        expect(delegatedSiteCodeMap(ServiceScope.ICT, [KRW, SKD, SPJ])).toEqual({ skd: 'SKD' });
    });

    it('keeps SKD standalone on ICT if SPJ is not present in the period', () => {
        expect(mergeHandledSites(ServiceScope.ICT, [KRW, SKD])).toEqual([
            { id: 'krw', code: 'KRW', name: 'Karawang', sourceSiteIds: ['krw'], handledCodes: [] },
            { id: 'skd', code: 'SKD', name: 'Sukodono', sourceSiteIds: ['skd'], handledCodes: [] },
        ]);
        expect(delegatedSiteCodeMap(ServiceScope.ICT, [KRW, SKD])).toEqual({});
    });

    it('never merges sites on HC scope', () => {
        expect(mergeHandledSites(ServiceScope.HC, [SPJ, SKD])).toHaveLength(2);
        expect(delegatedSiteCodeMap(ServiceScope.HC, [SPJ, SKD])).toEqual({});
    });
});
