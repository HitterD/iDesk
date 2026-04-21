import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Site } from '../modules/sites/entities/site.entity';
import { User } from '../modules/users/entities/user.entity';
import { Department } from '../modules/users/entities/department.entity';
import { UserRole } from '../modules/users/enums/user-role.enum';
import { PriorityWeight } from '../modules/workload/entities/priority-weight.entity';
import { NotificationSound, NotificationEventType } from '../modules/sound/entities/notification-sound.entity';
import { AccessType } from '../modules/access-request/entities/access-type.entity';

export async function runSeed(dataSource: DataSource): Promise<void> {
    console.log('🌱 Starting seed...');

    // ============================================
    // 1. SITES
    // ============================================
    const siteRepo = dataSource.getRepository(Site);

    const sites = [
        { code: 'SPJ', name: 'Sepanjang', isServerHost: true, description: 'Main server location' },
        { code: 'SMG', name: 'Semarang', isServerHost: false, description: 'Semarang branch' },
        { code: 'KRW', name: 'Karawang', isServerHost: false, description: 'Karawang branch' },
        { code: 'JTB', name: 'Jakarta', isServerHost: false, description: 'Jakarta branch' },
    ];

    const createdSites: Site[] = [];
    for (const siteData of sites) {
        let site = await siteRepo.findOne({ where: { code: siteData.code } });
        if (!site) {
            site = siteRepo.create(siteData);
            site = await siteRepo.save(site);
            console.log(`✅ Created site: ${site.code} - ${site.name}`);
        } else {
            console.log(`⏭️  Site already exists: ${site.code}`);
        }
        createdSites.push(site);
    }

    const spjSite = createdSites.find(s => s.code === 'SPJ')!;
    const smgSite = createdSites.find(s => s.code === 'SMG')!;

    // ============================================
    // 2. DEPARTMENTS (per site)
    // ============================================
    const deptRepo = dataSource.getRepository(Department);

    const departments = [
        { code: 'IT-SPJ', name: 'IT Department SPJ', siteId: spjSite.id },
        { code: 'HR-SPJ', name: 'HR Department SPJ', siteId: spjSite.id },
        { code: 'FIN-SPJ', name: 'Finance Department SPJ', siteId: spjSite.id },
        { code: 'IT-SMG', name: 'IT Department SMG', siteId: smgSite.id },
        { code: 'HR-SMG', name: 'HR Department SMG', siteId: smgSite.id },
    ];

    for (const deptData of departments) {
        let dept = await deptRepo.findOne({ where: { code: deptData.code } });
        if (!dept) {
            dept = deptRepo.create(deptData);
            await deptRepo.save(dept);
            console.log(`✅ Created department: ${dept.code}`);
        }
    }

    // ============================================
    // 3. PRIORITY WEIGHTS
    // ============================================
    const weightRepo = dataSource.getRepository(PriorityWeight);

    const priorityWeights = [
        { priority: 'LOW', points: 1, description: 'Low priority tickets' },
        { priority: 'MEDIUM', points: 2, description: 'Medium priority tickets' },
        { priority: 'HIGH', points: 4, description: 'High priority tickets' },
        { priority: 'CRITICAL', points: 8, description: 'Critical - requires immediate attention' },
        { priority: 'HARDWARE_INSTALLATION', points: 3, description: 'Hardware installation tickets' },
    ];

    for (const weightData of priorityWeights) {
        let weight = await weightRepo.findOne({ where: { priority: weightData.priority } });
        if (!weight) {
            weight = weightRepo.create(weightData);
            await weightRepo.save(weight);
            console.log(`✅ Created priority weight: ${weight.priority} = ${weight.points} points`);
        }
    }

    // ============================================
    // 4. DEFAULT NOTIFICATION SOUNDS
    // ============================================
    const soundRepo = dataSource.getRepository(NotificationSound);

    const defaultSounds = [
        { eventType: NotificationEventType.NEW_TICKET, soundName: 'New Ticket Alert', soundUrl: '/sounds/default/new-ticket.mp3' },
        { eventType: NotificationEventType.ASSIGNED, soundName: 'Ticket Assigned', soundUrl: '/sounds/default/assigned.mp3' },
        { eventType: NotificationEventType.RESOLVED, soundName: 'Ticket Resolved', soundUrl: '/sounds/default/resolved.mp3' },
        { eventType: NotificationEventType.CRITICAL, soundName: 'Critical Alert', soundUrl: '/sounds/default/critical-alert.mp3' },
        { eventType: NotificationEventType.MESSAGE, soundName: 'New Message', soundUrl: '/sounds/default/message.mp3' },
        { eventType: NotificationEventType.SLA_WARNING, soundName: 'SLA Warning', soundUrl: '/sounds/default/sla-warning.mp3' },
        { eventType: NotificationEventType.SLA_BREACH, soundName: 'SLA Breach', soundUrl: '/sounds/default/sla-breach.mp3' },
    ];

    for (const soundData of defaultSounds) {
        let sound = await soundRepo.findOne({
            where: { eventType: soundData.eventType, isDefault: true }
        });
        if (!sound) {
            sound = soundRepo.create({ ...soundData, isDefault: true, isActive: true });
            await soundRepo.save(sound);
            console.log(`✅ Created default sound: ${sound.eventType}`);
        }
    }

    // ============================================
    // 5. ACCESS TYPES
    // ============================================
    const accessTypeRepo = dataSource.getRepository(AccessType);

    const accessTypes = [
        { name: 'WiFi', description: 'WiFi network access request', validityDays: 365 },
        { name: 'VPN', description: 'VPN remote access request', validityDays: 180 },
        { name: 'Website', description: 'Website/URL unblock request', validityDays: 90 },
    ];

    for (const atData of accessTypes) {
        let at = await accessTypeRepo.findOne({ where: { name: atData.name } });
        if (!at) {
            at = accessTypeRepo.create(atData);
            await accessTypeRepo.save(at);
            console.log(`✅ Created access type: ${at.name}`);
        }
    }

    // ============================================
    // 6. DEFAULT USERS
    // ============================================
    const userRepo = dataSource.getRepository(User);
    const hashedPassword = await bcrypt.hash('admin123', 10);

    const users = [
        {
            email: 'admin@idesk.com',
            password: hashedPassword,
            fullName: 'System Administrator',
            role: UserRole.ADMIN,
            siteId: spjSite.id,
        },
        {
            email: 'manager@idesk.com',
            password: hashedPassword,
            fullName: 'Manager',
            role: UserRole.MANAGER,
            siteId: spjSite.id, // Manager assigned to main site but has cross-site access
        },
        {
            email: 'agent.spj@idesk.com',
            password: hashedPassword,
            fullName: 'Agent SPJ',
            role: UserRole.AGENT,
            siteId: spjSite.id,
        },
        {
            email: 'agent.smg@idesk.com',
            password: hashedPassword,
            fullName: 'Agent SMG',
            role: UserRole.AGENT,
            siteId: smgSite.id,
        },
        {
            email: 'user.spj@idesk.com',
            password: hashedPassword,
            fullName: 'User SPJ',
            role: UserRole.USER,
            siteId: spjSite.id,
        },
        {
            email: 'user.smg@idesk.com',
            password: hashedPassword,
            fullName: 'User SMG',
            role: UserRole.USER,
            siteId: smgSite.id,
        },
    ];

    for (const userData of users) {
        let user = await userRepo.findOne({ where: { email: userData.email } });
        if (!user) {
            user = userRepo.create(userData);
            await userRepo.save(user);
            console.log(`✅ Created user: ${user.email} (${user.role})`);
        }
    }

    console.log('🌱 Seed completed!');
}

// For running directly
export async function seed() {
    // This will be called from a script that initializes the DataSource
    console.log('Seed module loaded. Call runSeed(dataSource) to execute.');
}
