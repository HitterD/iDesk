import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Public } from '../../shared/core/decorators/public.decorator';
import { TvBoardService } from './tv-board.service';

@ApiTags('TV Board')
@Controller('tv')
export class TvBoardController {
    constructor(private readonly tvBoardService: TvBoardService) { }

    @Public()
    @Get('board/:token')
    @ApiOperation({ summary: 'Get kanban board data for a site by TV token (public, no auth)' })
    async getBoard(@Param('token') token: string) {
        const siteId = await this.tvBoardService.resolveSiteIdByToken(token);
        return this.tvBoardService.getBoardData(siteId);
    }
}
