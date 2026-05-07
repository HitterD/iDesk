import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserCrudService } from './user-crud.service';
import { UserImportService } from './user-import.service';
import { UserPasswordService } from './user-password.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CustomerSession } from './entities/customer-session.entity';
import { Department } from './entities/department.entity';
import { DepartmentsController } from './departments.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { Site } from '../sites/entities/site.entity';
import { PermissionsModule } from '../permissions/permissions.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, CustomerSession, Department, Ticket, Site]),
        forwardRef(() => PermissionsModule)
    ],
    controllers: [UsersController, DepartmentsController],
    providers: [
        UsersService,
        UserCrudService,
        UserImportService,
        UserPasswordService,
    ],
    exports: [
        UsersService,
        UserCrudService,
        UserImportService,
        UserPasswordService,
    ],
})
export class UsersModule { }
