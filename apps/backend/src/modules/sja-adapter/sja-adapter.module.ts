import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { SjaAdapterService } from './sja-adapter.service';
import { SjaOutboxProcessor } from './sja-outbox.processor';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'sja-outbox',
    }),
  ],
  providers: [SjaAdapterService, SjaOutboxProcessor],
  exports: [SjaAdapterService],
})
export class SjaAdapterModule {}
