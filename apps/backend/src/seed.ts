import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import { CreateAgentDto } from './modules/users/dto/create-agent.dto';
import { UserRole } from './modules/users/enums/user-role.enum';
import { DataSource } from 'typeorm';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);
    const dataSource = app.get(DataSource);

    console.log('Seeding database...');

    // Check if admin exists
    const adminEmail = 'admin@antigravity.com';
    const existingAdmin = await dataSource.getRepository('User').findOne({ where: { email: adminEmail } });

    if (!existingAdmin) {
        console.log('Creating Super Admin...');
        const adminDto: CreateAgentDto = {
            email: adminEmail,
            fullName: 'Super Admin',
            password: 'admin123',
        };

        // We use createAgent but manually update role to ADMIN afterwards since createAgent defaults to AGENT
        // Or we can add a createAdmin method to UsersService. 
        // For simplicity here, we assume createAgent creates a user, and we update the role.

        const user = await usersService.createAgent(adminDto);

        // Update to ADMIN
        await dataSource.getRepository('User').update(user.id, { role: UserRole.ADMIN });

        console.log('Super Admin created successfully.');
    } else {
        console.log('Super Admin already exists.');
    }

    await app.close();
}

bootstrap();
