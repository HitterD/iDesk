import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RequestDocumentRevision } from './entities/request-document-revision.entity';
import { RequestFlow } from './entities/request-flow.entity';

@Module({
    imports: [TypeOrmModule.forFeature([RequestFlow, RequestDocumentRevision])],
})
export class RequestFlowModule {}
