import { promises as dns } from 'dns';
import { NotFoundException } from '@nestjs/common';
import { RequesterDeviceService, isPrivateIp } from './requester-device.service';
import { HostnameSource, RDNS_ENV_FLAG } from './requester-device.constants';

describe('RequesterDeviceService', () => {
    let devices: Record<string, jest.Mock>;
    let tickets: Record<string, jest.Mock>;
    let service: RequesterDeviceService;
    let reverse: jest.SpyInstance;

    beforeEach(() => {
        devices = { upsert: jest.fn(), find: jest.fn(async () => []) };
        tickets = { findOne: jest.fn() };
        service = new RequesterDeviceService(devices as any, tickets as any);
        reverse = jest.spyOn(dns, 'reverse').mockResolvedValue(['sja-fin-pc012.sja.local.']);
        delete process.env[RDNS_ENV_FLAG];
    });

    afterEach(() => reverse.mockRestore());

    it('recognises private (office) addresses only', () => {
        expect(['10.10.6.45', '172.20.1.1', '192.168.1.9', '127.0.0.1', 'fd00::1'].every(isPrivateIp)).toBe(true);
        expect(['8.8.8.8', '172.32.0.1', '2001:4860::1', 'unknown'].some(isPrivateIp)).toBe(false);
    });

    it('stores a heartbeat per user and computer, falling back to the request IP', async () => {
        await service.recordHeartbeat('u-1', { hostname: 'SJA-FIN-PC012' }, '10.10.6.45');
        expect(devices.upsert).toHaveBeenCalledWith(
            expect.objectContaining({ userId: 'u-1', hostname: 'SJA-FIN-PC012', lanIp: '10.10.6.45', windowsUser: null }),
            ['userId', 'hostname'],
        );
    });

    it('names the computer from a fresh heartbeat, preferring the one on the request IP', async () => {
        devices.find.mockResolvedValue([
            { hostname: 'LAPTOP-HOME', lanIp: '10.10.9.9' },
            { hostname: 'SJA-FIN-PC012', lanIp: '10.10.6.45' },
        ]);
        await expect(service.snapshot('u-1', '10.10.6.45')).resolves.toEqual({
            requesterIp: '10.10.6.45', requesterHostname: 'SJA-FIN-PC012', requesterHostnameSource: HostnameSource.AGENT,
        });
        expect(reverse).not.toHaveBeenCalled();
    });

    it('falls back to reverse DNS for a private IP and trims the trailing dot', async () => {
        await expect(service.snapshot('u-1', '10.10.6.45')).resolves.toEqual({
            requesterIp: '10.10.6.45', requesterHostname: 'sja-fin-pc012.sja.local', requesterHostnameSource: HostnameSource.RDNS,
        });
    });

    it('keeps only the IP when reverse DNS fails, is off, or the IP is public', async () => {
        reverse.mockRejectedValue(new Error('ENOTFOUND'));
        await expect(service.snapshot('u-1', '10.10.6.45')).resolves.toMatchObject({ requesterIp: '10.10.6.45', requesterHostname: null });

        reverse.mockResolvedValue(['pc.sja.local']);
        process.env[RDNS_ENV_FLAG] = 'false';
        await expect(service.snapshot('u-1', '10.10.6.45')).resolves.toMatchObject({ requesterHostname: null });

        delete process.env[RDNS_ENV_FLAG];
        await expect(service.snapshot('u-1', '36.80.1.2')).resolves.toMatchObject({ requesterIp: '36.80.1.2', requesterHostname: null });
    });

    it('never throws: a database error still returns the IP', async () => {
        devices.find.mockRejectedValue(new Error('db down'));
        await expect(service.snapshot('u-1', '10.10.6.45')).resolves.toEqual({
            requesterIp: '10.10.6.45', requesterHostname: null, requesterHostnameSource: null,
        });
    });

    it('ignores a missing or malformed IP', async () => {
        await expect(service.snapshot('u-1', null)).resolves.toEqual({ requesterIp: null, requesterHostname: null, requesterHostnameSource: null });
        await expect(service.snapshot('u-1', 'unknown')).resolves.toMatchObject({ requesterIp: null });
    });

    it('returns the stored snapshot and recent devices for a ticket', async () => {
        tickets.findOne.mockResolvedValue({ id: 't-1', userId: 'u-1', requesterIp: '10.10.6.45', requesterHostname: 'PC012', requesterHostnameSource: 'AGENT' });
        devices.find.mockResolvedValue([{ hostname: 'PC012', lanIp: '10.10.6.45', osVersion: 'Windows 11', lastSeenAt: new Date() }]);

        const result = await service.forTicket('t-1');
        expect(result).toMatchObject({ requesterIp: '10.10.6.45', requesterHostname: 'PC012', requesterHostnameSource: 'AGENT' });
        expect(result.recentDevices).toHaveLength(1);

        tickets.findOne.mockResolvedValue(null);
        await expect(service.forTicket('t-x')).rejects.toBeInstanceOf(NotFoundException);
    });
});
