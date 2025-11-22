import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
// import { User } from './user.entity';

@Entity('departments')
export class Department {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column()
    name: string;

    @Column({ unique: true })
    code: string;

    // @OneToMany(() => User, (user) => user.department)
    // users: User[];
}
