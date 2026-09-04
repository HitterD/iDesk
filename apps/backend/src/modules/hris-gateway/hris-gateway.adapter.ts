import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';

export interface HrisEmployee {
    nik_hris: string;
    nik_santos: string | null;
    nama_karyawan: string;
    id_departemen: string | null;
    nama_departemen: string | null;
    nama_jabatan: string | null;
    email: string | null;
    lokasi: string | null;
    tgl_keluar: string | null;
}

export interface HrisVerifyResult {
    valid: boolean;
    eligible: boolean;
    match: boolean;
}

export class HrisUnavailableError extends Error {
    readonly cause?: unknown;

    constructor(message = 'HRIS gateway unavailable', options?: { cause?: unknown }) {
        super(message);
        this.name = 'HrisUnavailableError';
        this.cause = options?.cause;
    }
}

export class HrisInvalidResponseError extends Error {
    constructor(message = 'Invalid HRIS gateway response') {
        super(message);
        this.name = 'HrisInvalidResponseError';
    }
}

function isVerifyResult(value: unknown): value is HrisVerifyResult {
    if (!value || typeof value !== 'object') return false;
    const result = value as Record<string, unknown>;
    return typeof result.valid === 'boolean'
        && typeof result.eligible === 'boolean'
        && typeof result.match === 'boolean';
}

function errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : 'unknown error';
}

export interface HrisEmployeesPage {
    data: HrisEmployee[];
    total: number;
}

const GET_RETRIES = 3;
const DEFAULT_TIMEOUT_MS = 10_000;
const MAX_TIMEOUT_MS = 30_000;

/** Bounded per-request timeout; invalid or out-of-range values fall back to the default. */
export function resolveRequestTimeoutMs(raw = process.env.HRIS_GATEWAY_TIMEOUT_MS): number {
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) return DEFAULT_TIMEOUT_MS;
    return Math.min(parsed, MAX_TIMEOUT_MS);
}

/**
 * Whether NIK logins should verify the password against HRIS.
 *
 * Opt-out only: anything other than an explicit `false` keeps verification on, so a
 * typo cannot silently downgrade authentication. Disabling it makes every NIK login
 * rely on the locally stored password, which only exists for users an admin has
 * reset or that HRIS sync has provisioned — intended for development against an
 * unreachable gateway, not for production.
 */
export function isHrisLoginVerifyEnabled(raw = process.env.HRIS_LOGIN_VERIFY_ENABLED): boolean {
    return raw?.trim().toLowerCase() !== 'false';
}

@Injectable()
export class HrisGatewayAdapter {
    private readonly logger = new Logger(HrisGatewayAdapter.name);
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: process.env.HRIS_GATEWAY_BASE_URL,
            timeout: resolveRequestTimeoutMs(),
            headers: {
                'X-API-Key': process.env.HRIS_GATEWAY_API_KEY || '',
                'Content-Type': 'application/json',
            },
        });
    }

    isConfigured(): boolean {
        return Boolean(process.env.HRIS_GATEWAY_BASE_URL && process.env.HRIS_GATEWAY_API_KEY);
    }

    async ping(): Promise<boolean> {
        try {
            return (await this.http.get('/ping')).data?.ok === true;
        } catch {
            return false;
        }
    }

    async verifyPassword(nik: string, password: string): Promise<HrisVerifyResult> {
        try {
            const result: unknown = (await this.http.post('/auth/verify', { nik, password })).data;
            if (!isVerifyResult(result)) throw new HrisInvalidResponseError();
            return result;
        } catch (error) {
            if (error instanceof HrisInvalidResponseError) throw error;
            this.logger.warn(`HRIS password verification unavailable: ${errorMessage(error)}`);
            throw new HrisUnavailableError(undefined, { cause: error });
        }
    }

    async getEmployee(nik: string): Promise<HrisEmployee | null> {
        const employee = await this.getWithRetry<HrisEmployee>(`/employees/${encodeURIComponent(nik)}`);
        return employee?.nik_hris ? employee : null;
    }

    async getEmployeesPage(page: number): Promise<HrisEmployeesPage | null> {
        return this.getWithRetry<HrisEmployeesPage>(`/employees?page=${page}`);
    }

    private async getWithRetry<T>(url: string): Promise<T | null> {
        for (let attempt = 1; attempt <= GET_RETRIES; attempt++) {
            try {
                return (await this.http.get(url)).data as T;
            } catch (error: any) {
                this.logger.warn(`HRIS request failed (${attempt}/${GET_RETRIES}): ${error.message}`);
            }
        }
        return null;
    }
}
