import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { HttpExceptionFilter } from './shared/core/filters/http-exception.filter';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { LoggingInterceptor } from './shared/core/interceptors/logging.interceptor';

async function bootstrap() {
    const app = await NestFactory.create(AppModule);

    app.enableCors({
        origin: 'http://localhost:4050', // Restrict to Frontend Port
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
        credentials: true,
    });

    // Ensure uploads directory exists
    const fs = require('fs');
    const uploadDir = './uploads';
    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir);
    }

    app.useGlobalPipes(new ValidationPipe({
        whitelist: true,
        transform: true,
    }));

    app.useGlobalFilters(new HttpExceptionFilter());
    app.useGlobalInterceptors(new LoggingInterceptor());

    // Security Headers
    app.use(helmet());

    // Swagger Documentation
    const config = new DocumentBuilder()
        .setTitle('iDesk API')
        .setDescription('The iDesk Helpdesk API description')
        .setVersion('1.0')
        .addBearerAuth()
        .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);

    await app.listen(5050);
    console.log(`Application is running on: ${await app.getUrl()}`);
}
bootstrap();
