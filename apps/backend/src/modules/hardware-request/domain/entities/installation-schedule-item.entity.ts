import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryGeneratedColumn, Unique } from 'typeorm';
import { HardwareRequestItem } from './hardware-request-item.entity';
import { InstallationSchedule } from './installation-schedule.entity';

@Entity({ name: 'installation_schedule_items' })
@Unique(['scheduleId', 'itemId'])
@Index(['scheduleId'])
@Index(['itemId'])
export class InstallationScheduleItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'schedule_id', type: 'uuid' })
  scheduleId!: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId!: string;

  @ManyToOne(() => InstallationSchedule, (s) => s.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'schedule_id' })
  schedule!: InstallationSchedule;

  @ManyToOne(() => HardwareRequestItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item!: HardwareRequestItem;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
