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

export interface HrisEmployeesPage {
    data: HrisEmployee[];
    total: number;
}

const GET_RETRIES = 3;
const REQUEST_TIMEOUT_MS = 10_000;

@Injectable()
export class HrisGatewayAdapter {
    private readonly logger = new Logger(HrisGatewayAdapter.name);
    private readonly http: AxiosInstance;

    constructor() {
        this.http = axios.create({
            baseURL: process.env.HRIS_GATEWAY_BASE_URL,
            timeout: REQUEST_TIMEOUT_MS,
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

    /** null means Gateway failed; match:false means Gateway rejected password. */
    async verifyPassword(nik: string, password: string): Promise<HrisVerifyResult | null> {
        try {
            return (await this.http.post('/auth/verify', { nik, password })).data;
        } catch (error: any) {
            this.logger.warn(`HRIS password verification unavailable: ${error.message}`);
            return null;
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
