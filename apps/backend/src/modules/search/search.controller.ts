import {
    Controller,
    Get,
    Post,
    Delete,
    Query,
    Body,
    Param,
    Req,
    UseGuards,
    HttpCode,
    HttpStatus,
} from '@nestjs/common';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBearerAuth,
    ApiQuery,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchFilterDto } from './dto/search-filter.dto';
import { SearchResultDto, SearchSuggestionDto } from './dto/search-result.dto';
import { SavedSearch } from './entities/saved-search.entity';

class SaveSearchDto {
    name: string;
    description?: string;
    query?: string;
    filters: SearchFilterDto;
}

@ApiTags('Search')
@ApiBearerAuth()
@Controller('search')
@UseGuards(JwtAuthGuard)
export class SearchController {
    constructor(private readonly searchService: SearchService) {}

    @Get()
    @ApiOperation({ summary: 'Unified search across all entities' })
    @ApiResponse({ status: 200, description: 'Search results', type: SearchResultDto })
    @ApiQuery({ name: 'q', required: false, description: 'Search query' })
    @ApiQuery({ name: 'scope', required: false, isArray: true, enum: ['tickets', 'users', 'articles'] })
    @ApiQuery({ name: 'status', required: false, isArray: true })
    @ApiQuery({ name: 'priority', required: false, isArray: true })
    @ApiQuery({ name: 'limit', required: false, type: Number })
    @ApiQuery({ name: 'page', required: false, type: Number })
    async search(@Query() query: SearchQueryDto): Promise<SearchResultDto> {
        return this.searchService.search(query);
    }

    @Get('tickets')
    @ApiOperation({ summary: 'Search tickets only' })
    @ApiResponse({ status: 200, description: 'Ticket search results' })
    async searchTickets(@Query() query: SearchQueryDto): Promise<SearchResultDto> {
        return this.searchService.search({
            ...query,
            scope: ['tickets'],
        });
    }

    @Get('users')
    @ApiOperation({ summary: 'Search users only' })
    @ApiResponse({ status: 200, description: 'User search results' })
    async searchUsers(@Query() query: SearchQueryDto): Promise<SearchResultDto> {
        return this.searchService.search({
            ...query,
            scope: ['users'],
        });
    }

    @Get('articles')
    @ApiOperation({ summary: 'Search knowledge base articles only' })
    @ApiResponse({ status: 200, description: 'Article search results' })
    async searchArticles(@Query() query: SearchQueryDto): Promise<SearchResultDto> {
        return this.searchService.search({
            ...query,
            scope: ['articles'],
        });
    }

    @Get('suggestions')
    @ApiOperation({ summary: 'Get search suggestions (autocomplete)' })
    @ApiResponse({ status: 200, description: 'Search suggestions', type: [SearchSuggestionDto] })
    @ApiQuery({ name: 'q', required: true, description: 'Partial query for suggestions' })
    async getSuggestions(@Query('q') query: string): Promise<SearchSuggestionDto[]> {
        return this.searchService.getSuggestions(query);
    }

    @Get('popular')
    @ApiOperation({ summary: 'Get popular search terms' })
    @ApiResponse({ status: 200, description: 'Popular search terms', type: [String] })
    async getPopularSearches(): Promise<string[]> {
        return this.searchService.getPopularSearches();
    }

    @Get('saved')
    @ApiOperation({ summary: 'Get saved searches for current user' })
    @ApiResponse({ status: 200, description: 'Saved searches', type: [SavedSearch] })
    async getSavedSearches(@Req() req): Promise<SavedSearch[]> {
        return this.searchService.getSavedSearches(req.user.userId);
    }

    @Post('saved')
    @ApiOperation({ summary: 'Save a search for quick access' })
    @ApiResponse({ status: 201, description: 'Search saved', type: SavedSearch })
    async saveSearch(
        @Req() req,
        @Body() dto: SaveSearchDto,
    ): Promise<SavedSearch> {
        return this.searchService.saveSearch(
            req.user.userId,
            dto.name,
            dto.query,
            dto.filters,
            dto.description,
        );
    }

    @Post('saved/:id/use')
    @HttpCode(HttpStatus.OK)
    @ApiOperation({ summary: 'Mark a saved search as used (increments counter)' })
    @ApiResponse({ status: 200, description: 'Search use recorded' })
    async useSavedSearch(
        @Req() req,
        @Param('id') searchId: string,
    ): Promise<SavedSearch | null> {
        return this.searchService.useSavedSearch(req.user.userId, searchId);
    }

    @Delete('saved/:id')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({ summary: 'Delete a saved search' })
    @ApiResponse({ status: 204, description: 'Search deleted' })
    async deleteSavedSearch(
        @Req() req,
        @Param('id') searchId: string,
    ): Promise<void> {
        await this.searchService.deleteSavedSearch(req.user.userId, searchId);
    }
}
