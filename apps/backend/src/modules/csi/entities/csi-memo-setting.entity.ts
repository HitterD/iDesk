import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { MemoHeaderDto } from '../dto/memo.dto';

/** Last memo header used per service scope, so the next memo starts pre-filled. */
@Entity('csi_memo_settings')
export class CsiMemoSetting {
    @PrimaryColumn({ type: 'varchar', length: 20 })
    scope: string;

    @Column({ type: 'jsonb' })
    data: MemoHeaderDto;

    @UpdateDateColumn()
    updatedAt: Date;
}
