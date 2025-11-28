import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum AttributeType {
    CATEGORY = 'CATEGORY',
    PRIORITY = 'PRIORITY',
    DEVICE = 'DEVICE',
    SOFTWARE = 'SOFTWARE',
}

@Entity('ticket_attributes')
export class TicketAttribute {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({
        type: 'enum',
        enum: AttributeType,
    })
    type: AttributeType;

    @Column()
    value: string;

    @Column({ default: true })
    isEnabled: boolean;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
