import { Injectable, Logger } from '@nestjs/common';
import { Context } from 'telegraf';
import { TelegramService } from '../telegram.service';

interface InlineQueryResult {
    type: string;
    id: string;
    title: string;
    description?: string;
    input_message_content: {
        message_text: string;
        parse_mode?: string;
    };
}

@Injectable()
export class InlineHandler {
    private readonly logger = new Logger(InlineHandler.name);

    constructor(private readonly telegramService: TelegramService) {}

    async handleInlineQuery(ctx: Context): Promise<void> {
        const query = (ctx.inlineQuery as any)?.query?.trim() || '';
        const from = ctx.from;
        
        if (!from || query.length < 2) {
            await (ctx as any).answerInlineQuery([]);
            return;
        }

        const session = await this.telegramService.getSession(String(from.id));
        const results: InlineQueryResult[] = [];

        // Search Knowledge Base
        const articles = await this.telegramService.searchKnowledgeBase(query);
        for (const article of articles.slice(0, 3)) {
            results.push({
                type: 'article',
                id: `kb_${article.id}`,
                title: `📄 ${article.title}`,
                description: article.excerpt?.substring(0, 100) || 'Knowledge Base Article',
                input_message_content: {
                    message_text: `📄 <b>${article.title}</b>\n\n${article.excerpt || ''}\n\n<i>Dari Knowledge Base iDesk</i>`,
                    parse_mode: 'HTML',
                },
            });
        }

        // Search user's tickets if linked
        if (session?.userId) {
            const tickets = await this.telegramService.searchUserTickets(session.userId, query);
            for (const ticket of tickets.slice(0, 3)) {
                const statusEmoji: Record<string, string> = {
                    'TODO': '🔵',
                    'IN_PROGRESS': '🟡',
                    'RESOLVED': '🟢',
                    'CANCELLED': '🔴'
                };
                results.push({
                    type: 'article',
                    id: `ticket_${ticket.id}`,
                    title: `🎫 ${ticket.title}`,
                    description: `#${ticket.ticketNumber} • ${ticket.status}`,
                    input_message_content: {
                        message_text: 
                            `🎫 <b>Tiket #${ticket.ticketNumber}</b>\n\n` +
                            `📌 ${ticket.title}\n` +
                            `${statusEmoji[ticket.status] || '⚪'} Status: ${ticket.status}\n` +
                            `⚡ Prioritas: ${ticket.priority}`,
                        parse_mode: 'HTML',
                    },
                });
            }
        }

        await (ctx as any).answerInlineQuery(results, { cache_time: 60 });
        this.logger.debug(`Inline query "${query}" returned ${results.length} results`);
    }
}
