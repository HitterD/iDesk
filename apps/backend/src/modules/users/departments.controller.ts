import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { UserRole } from './enums/user-role.enum';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Department } from './entities/department.entity';

@Controller('departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.MANAGER)
export class DepartmentsController {
    constructor(
        @InjectRepository(Department)
        private readonly departmentRepo: Repository<Department>,
    ) { }

    @Get()
    async findAll() {
        const count = await this.departmentRepo.count();
        if (count === 0) {
            // Seed initial departments
            const departments = [
                { name: 'Information Technology', code: 'IT' },
                { name: 'Human Resources', code: 'HR' },
                { name: 'Finance', code: 'FIN' },
                { name: 'Sales & Marketing', code: 'MKT' },
                { name: 'Operations', code: 'OPS' },
            ];
            await this.departmentRepo.save(departments);
        }
        return this.departmentRepo.find();
    }
    @Post()
    async create(@Body() body: { name: string; code: string }) {
        const department = this.departmentRepo.create(body);
        return this.departmentRepo.save(department);
    }
}
