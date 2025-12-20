/**
 * iDesk Automated Test Script - Fixed Version
 * Run with: npx ts-node src/tests/api-test.ts
 */
import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:5050';

interface TestResult {
    name: string;
    passed: boolean;
    error?: string;
}

class ApiTester {
    private token: string = '';
    private results: TestResult[] = [];

    private async request(method: string, path: string, data?: any, params?: any) {
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (this.token) {
            headers['Authorization'] = `Bearer ${this.token}`;
        }

        try {
            const res = await axios({
                method,
                url: `${API_URL}${path}`,
                headers,
                data,
                params,
                validateStatus: () => true,
            });
            return res;
        } catch (error: any) {
            return { status: 0, data: { error: error.message } };
        }
    }

    private async login(email: string, password: string): Promise<boolean> {
        try {
            const res = await axios.post(`${API_URL}/auth/login`, { email, password });
            if (res.status === 200 || res.status === 201) {
                this.token = res.data.access_token;
                return true;
            }
            return false;
        } catch (err: any) {
            if (err.response?.status === 429) {
                console.log('    ⚠️ Rate limit hit - please wait 60s before re-running tests');
            } else {
                console.log('    Login error:', err.response?.status || err.message);
            }
            return false;
        }
    }

    private log(msg: string) { console.log(`[TEST] ${msg}`); }

    private async test(name: string, fn: () => Promise<boolean>) {
        try {
            const passed = await fn();
            this.results.push({ name, passed });
            console.log(passed ? `  ✅ ${name}` : `  ❌ ${name}`);
        } catch (error: any) {
            this.results.push({ name, passed: false, error: error.message });
            console.log(`  ❌ ${name} - Error: ${error.message}`);
        }
    }

    async testAuth() {
        console.log('\n📋 AUTH TESTS');

        await this.test('Login as ADMIN', async () => {
            return await this.login('admin@idesk.com', 'admin123');
        });

        await this.test('Login as MANAGER', async () => {
            return await this.login('manager@idesk.com', 'admin123');
        });

        await this.test('Login as AGENT (SPJ)', async () => {
            return await this.login('agent.spj@idesk.com', 'admin123');
        });

        await this.test('Login as USER (SPJ)', async () => {
            return await this.login('user.spj@idesk.com', 'admin123');
        });

        await this.test('Invalid login should fail', async () => {
            try {
                await axios.post(`${API_URL}/auth/login`, { email: 'invalid@x.com', password: 'wrong' });
                return false;
            } catch { return true; }
        });
    }

    async testSites() {
        console.log('\n🏢 SITES TESTS');
        await this.login('admin@idesk.com', 'admin123');

        await this.test('List all sites', async () => {
            const res = await this.request('GET', '/sites');
            if (res.status === 200 && Array.isArray(res.data)) {
                this.log(`Found ${res.data.length} sites`);
                return res.data.length >= 4;
            }
            return false;
        });

        await this.test('Get site by code (SPJ)', async () => {
            const res = await this.request('GET', '/sites');
            if (res.status === 200) {
                const spj = res.data.find((s: any) => s.code === 'SPJ');
                return spj && spj.isServerHost === true;
            }
            return false;
        });
    }

    async testTickets() {
        console.log('\n🎫 TICKET TESTS');
        await this.login('user.spj@idesk.com', 'admin123');

        let ticketId = '';

        await this.test('Create ticket', async () => {
            const res = await this.request('POST', '/tickets', {
                title: 'Test Ticket from API Test',
                description: 'Automated test ticket',
                category: 'GENERAL',
                priority: 'MEDIUM',
            });
            if (res.status === 200 || res.status === 201) {
                ticketId = res.data.id;
                this.log(`Created ticket: ${res.data.ticketNumber}`);
                return true;
            }
            console.log('    Failed:', res.status, res.data?.message);
            return false;
        });

        await this.test('List my tickets', async () => {
            const res = await this.request('GET', '/tickets');
            return res.status === 200;
        });

        await this.test('Get ticket detail', async () => {
            if (!ticketId) return false;
            const res = await this.request('GET', `/tickets/${ticketId}`);
            return res.status === 200;
        });
    }

    async testManagerDashboard() {
        console.log('\n📊 MANAGER DASHBOARD TESTS');
        await this.login('manager@idesk.com', 'admin123');

        await this.test('Get manager dashboard stats', async () => {
            const res = await this.request('GET', '/manager/dashboard');
            if (res.status === 200) {
                this.log(`Total tickets: ${res.data.totalTickets || 0}`);
                return true;
            }
            return false;
        });

        await this.test('Get top agents', async () => {
            const res = await this.request('GET', '/manager/dashboard/top-agents');
            return res.status === 200;
        });

        await this.test('Get open tickets by site', async () => {
            const res = await this.request('GET', '/manager/dashboard/open-tickets');
            return res.status === 200;
        });

        await this.test('Get trend data', async () => {
            const res = await this.request('GET', '/manager/dashboard/trend');
            return res.status === 200;
        });

        await this.test('Get critical tickets', async () => {
            const res = await this.request('GET', '/manager/dashboard/critical');
            return res.status === 200;
        });
    }

    async testReports() {
        console.log('\n📈 REPORTS TESTS');
        await this.login('manager@idesk.com', 'admin123');

        await this.test('Generate consolidated report', async () => {
            const res = await this.request('GET', '/manager/reports', null, {
                reportType: 'CONSOLIDATED', period: 'MONTHLY'
            });
            return res.status === 200;
        });

        await this.test('Get ticket stats', async () => {
            const res = await this.request('GET', '/manager/reports/ticket-stats');
            return res.status === 200;
        });

        await this.test('Get agent performance', async () => {
            const res = await this.request('GET', '/manager/reports/agent-performance');
            return res.status === 200;
        });

        await this.test('Get SLA metrics', async () => {
            const res = await this.request('GET', '/manager/reports/sla-metrics');
            return res.status === 200;
        });
    }

    async testSoundModule() {
        console.log('\n🔔 SOUND MODULE TESTS');
        await this.login('admin@idesk.com', 'admin123');

        await this.test('List notification sounds', async () => {
            const res = await this.request('GET', '/sounds');
            if (res.status === 200) {
                this.log(`Found ${res.data?.length || 0} sounds`);
                return true;
            }
            return false;
        });
    }

    async testSynologyModule() {
        console.log('\n💾 SYNOLOGY MODULE TESTS');
        await this.login('admin@idesk.com', 'admin123');

        await this.test('List backup configurations', async () => {
            const res = await this.request('GET', '/backup/configs');
            return res.status === 200;
        });

        await this.test('List backup history', async () => {
            const res = await this.request('GET', '/backup/history');
            return res.status === 200;
        });
    }

    async testWorkloadModule() {
        console.log('\n⚖️ WORKLOAD MODULE TESTS');
        await this.login('admin@idesk.com', 'admin123');

        await this.test('Get priority weights', async () => {
            const res = await this.request('GET', '/workload/priority-weights');
            if (res.status === 200) {
                this.log(`Found ${res.data?.length || 0} priority weights`);
                return true;
            }
            return false;
        });

        await this.test('Get agent workloads', async () => {
            const res = await this.request('GET', '/workload/agents');
            return res.status === 200;
        });
    }

    async testIctBudget() {
        console.log('\n💰 ICT BUDGET TESTS');
        await this.login('user.spj@idesk.com', 'admin123');

        await this.test('Create ICT Budget request', async () => {
            const res = await this.request('POST', '/ict-budget', {
                title: 'New Laptop Request',
                requestType: 'PURCHASE',
                budgetCategory: 'Hardware Purchase',
                itemName: 'Dell Latitude 5550',
                estimatedAmount: 15000000,
                quantity: 1,
                justification: 'Need new laptop for WFH',
                urgencyLevel: 'NORMAL',
            });
            if (res.status === 200 || res.status === 201) {
                this.log(`Created ICT Budget: ${res.data.id}`);
                return true;
            }
            console.log('    Failed:', res.status, res.data?.message);
            return false;
        });

        await this.test('List ICT Budget requests', async () => {
            const res = await this.request('GET', '/ict-budget');
            return res.status === 200;
        });
    }

    async testLostItem() {
        console.log('\n📦 LOST ITEM TESTS');
        await this.login('user.spj@idesk.com', 'admin123');

        await this.test('Create Lost Item report', async () => {
            const res = await this.request('POST', '/lost-item', {
                itemType: 'Laptop',
                itemName: 'Dell Laptop Black',
                lastSeenLocation: 'Meeting Room 3rd Floor',
                lastSeenDatetime: new Date().toISOString(),
                circumstances: 'Left after meeting',
            });
            if (res.status === 200 || res.status === 201) {
                this.log(`Created Lost Item: ${res.data.id}`);
                return true;
            }
            console.log('    Failed:', res.status, res.data?.message);
            return false;
        });

        await this.test('List Lost Item reports', async () => {
            const res = await this.request('GET', '/lost-item');
            return res.status === 200;
        });
    }

    async testAccessRequest() {
        console.log('\n🔐 ACCESS REQUEST TESTS');
        await this.login('admin@idesk.com', 'admin123');

        await this.test('List access types', async () => {
            const res = await this.request('GET', '/access-request/types');
            if (res.status === 200) {
                this.log(`Found ${res.data?.length || 0} access types`);
                return true;
            }
            return false;
        });

        await this.login('user.spj@idesk.com', 'admin123');

        await this.test('Create Access Request', async () => {
            const res = await this.request('POST', '/access-request', {
                accessTypeName: 'WiFi',
                requestedAccess: 'Office WiFi Network',
                purpose: 'Work from office',
                validFrom: new Date().toISOString().split('T')[0],
                validUntil: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            });
            if (res.status === 200 || res.status === 201) {
                this.log(`Created Access Request: ${res.data.id}`);
                return true;
            }
            console.log('    Failed:', res.status, res.data?.message);
            return false;
        });

        await this.test('List Access Requests', async () => {
            const res = await this.request('GET', '/access-request');
            return res.status === 200;
        });
    }

    async runAll() {
        console.log('╔════════════════════════════════════════════════════════════════╗');
        console.log('║           iDesk API Automated Test Suite                        ║');
        console.log('║           API URL:', API_URL.padEnd(45), '║');
        console.log('╚════════════════════════════════════════════════════════════════╝');

        await this.testAuth();
        await this.testSites();
        await this.testTickets();
        await this.testManagerDashboard();
        await this.testReports();
        await this.testSoundModule();
        await this.testSynologyModule();
        await this.testWorkloadModule();
        await this.testIctBudget();
        await this.testLostItem();
        await this.testAccessRequest();

        this.printSummary();
    }

    private printSummary() {
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        const total = this.results.length;

        console.log('\n╔════════════════════════════════════════════════════════════════╗');
        console.log('║                         TEST SUMMARY                            ║');
        console.log('╠════════════════════════════════════════════════════════════════╣');
        console.log(`║  Total:  ${total.toString().padEnd(4)} │  Passed: ${passed.toString().padEnd(4)} │  Failed: ${failed.toString().padEnd(4)}         ║`);
        console.log('╚════════════════════════════════════════════════════════════════╝');

        if (failed > 0) {
            console.log('\n❌ Failed Tests:');
            this.results.filter(r => !r.passed).forEach(r => {
                console.log(`  - ${r.name}${r.error ? `: ${r.error}` : ''}`);
            });
        }

        console.log(`\n${passed === total ? '✅ All tests passed!' : `⚠️ ${failed} tests failed`}`);
    }
}

const tester = new ApiTester();
tester.runAll().catch(console.error);
