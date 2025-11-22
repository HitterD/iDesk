import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { UsersService } from './modules/users/users.service';
import * as bcrypt from 'bcrypt';

async function bootstrap() {
    const app = await NestFactory.createApplicationContext(AppModule);
    const usersService = app.get(UsersService);

    const email = 'admin@antigravity.com';
    const password = 'admin123';

    console.log(`Checking user: ${email}`);
    const user = await usersService.findByEmail(email);

    if (user) {
        console.log('User found:', user.id, user.email, user.role);
        console.log('Stored Hash:', user.password);

        const isMatch = await bcrypt.compare(password, user.password);
        console.log(`Password '${password}' match:`, isMatch);

        if (!isMatch) {
            console.log('Attempting to re-hash and update...');
            const newHash = await bcrypt.hash(password, 10);
            await usersService.update(user.id, { password: newHash });
            console.log('Password updated.');
        }
    } else {
        console.log('User NOT found.');
    }

    await app.close();
}

bootstrap();
