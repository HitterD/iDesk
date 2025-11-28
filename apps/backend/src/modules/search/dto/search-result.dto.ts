import { ApiProperty } from '@nestjs/swagger';

export class TicketSearchResult {
    @ApiProperty()
    id: string;

    @ApiProperty()
    ticketNumber: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    priority: string;

    @ApiProperty()
    createdAt: Date;

    @ApiProperty({ required: false })
    userName?: string;

    @ApiProperty({ required: false })
    assignedToName?: string;

    @ApiProperty({ required: false })
    highlight?: string;

    @ApiProperty({ required: false })
    category?: string;

    @ApiProperty({ required: false })
    source?: string;
}

export class UserSearchResult {
    @ApiProperty()
    id: string;

    @ApiProperty()
    fullName: string;

    @ApiProperty()
    email: string;

    @ApiProperty({ required: false })
    department?: string;

    @ApiProperty({ required: false })
    jobTitle?: string;

    @ApiProperty()
    role: string;

    @ApiProperty({ required: false })
    highlight?: string;
}

export class ArticleSearchResult {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty({ required: false })
    category?: string;

    @ApiProperty({ required: false, isArray: true })
    tags?: string[];

    @ApiProperty({ required: false })
    highlight?: string;

    @ApiProperty()
    viewCount: number;

    @ApiProperty()
    createdAt: Date;
}

export class SearchResultDto {
    @ApiProperty({ type: [TicketSearchResult] })
    tickets: TicketSearchResult[];

    @ApiProperty({ type: [UserSearchResult] })
    users: UserSearchResult[];

    @ApiProperty({ type: [ArticleSearchResult] })
    articles: ArticleSearchResult[];

    @ApiProperty({ description: 'Total count across all scopes' })
    totalCount: number;

    @ApiProperty({ description: 'Search execution time in milliseconds' })
    timing: number;

    @ApiProperty({ description: 'Current page' })
    page: number;

    @ApiProperty({ description: 'Results per page' })
    limit: number;

    @ApiProperty({ description: 'Whether there are more results' })
    hasMore: boolean;
}

export class SearchSuggestionDto {
    @ApiProperty()
    text: string;

    @ApiProperty()
    type: 'ticket' | 'user' | 'article' | 'tag';

    @ApiProperty({ required: false })
    id?: string;
}
