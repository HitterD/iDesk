import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { CustomerSession } from './entities/customer-session.entity';
import { Department } from './entities/department.entity';
import { DepartmentsController } from './departments.controller';
import { Ticket } from '../ticketing/entities/ticket.entity';

@Module({
    imports: [TypeOrmModule.forFeature([User, CustomerSession, Department, Ticket])],
    controllers: [UsersController, DepartmentsController],
    providers: [UsersService],
    exports: [UsersService],
})
export class UsersModule { }
