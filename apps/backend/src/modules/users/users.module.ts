import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UserCrudService } from './user-crud.service';
import { UserImportService } from './user-import.service';
import { UserPasswordService } from './user-password.service';
import { UserEmailService } from './user-email.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { Department } from './entities/department.entity';
import { DepartmentsController } from './departments.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';
import { TicketModule } from '../ticketing/entities/ticket-module.entity';
import { Site } from '../sites/entities/site.entity';
import { PriorityWeight } from '../workload/entities/priority-weight.entity';
import { PermissionsModule } from '../permissions/permissions.module';
import { SlaConfigModule } from '../sla-config/sla-config.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([User, Department, Ticket, Site, TicketModule, PriorityWeight]),
        forwardRef(() => PermissionsModule),
        SlaConfigModule, // Business hours: install-day gating of live workload points
    ],
    controllers: [UsersController, DepartmentsController],
    providers: [
        UsersService,
        UserCrudService,
        UserImportService,
        UserPasswordService,
        UserEmailService,
    ],
    exports: [
        UsersService,
        UserCrudService,
        UserImportService,
        UserPasswordService,
        UserEmailService,
    ],
})
export class UsersModule { }
