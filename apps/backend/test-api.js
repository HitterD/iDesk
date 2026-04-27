const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('./src/app.module');
const { UsersService } = require('./src/modules/users/users.service');

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const usersService = app.get(UsersService);
  const approvers = await usersService.getApprovers();
  console.log('Number of approvers returned:', approvers.length);
  console.log(approvers.map(a => a.fullName + ' - ' + a.role).join('\n'));
  await app.close();
}

bootstrap().catch(console.error);
