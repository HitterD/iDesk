import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TicketSurvey } from './entities/ticket-survey.entity';
import { v4 as uuidv4 } from 'uuid';
import { MailerService } from '@nestjs-modules/mailer';
import { Ticket } from './entities/ticket.entity';

@Injectable()
export class SurveysService {
    constructor(
        @InjectRepository(TicketSurvey)
        private readonly surveyRepo: Repository<TicketSurvey>,
        private readonly mailerService: MailerService,
    ) { }

    async createSurvey(ticket: Ticket) {
        const token = uuidv4();
        const survey = this.surveyRepo.create({
            ticketId: ticket.id,
            token,
        });
        await this.surveyRepo.save(survey);

        // Send Email
        try {
            console.log(`[Survey] Generated token ${token} for ticket ${ticket.id}`);
        } catch (error) {
            console.error('Failed to send survey email:', error);
        }

        return survey;
    }

    async submitSurvey(token: string, rating: number, comment: string) {
        const survey = await this.surveyRepo.findOne({ where: { token } });
        if (!survey) {
            throw new NotFoundException('Invalid survey token');
        }

        if (survey.isSubmitted) {
            throw new BadRequestException('Survey already submitted');
        }

        survey.rating = rating;
        survey.comment = comment;
        survey.isSubmitted = true;
        return this.surveyRepo.save(survey);
    }

    async getStats() {
        const result = await this.surveyRepo
            .createQueryBuilder('survey')
            .select('AVG(survey.rating)', 'averageRating')
            .where('survey.isSubmitted = :isSubmitted', { isSubmitted: true })
            .getRawOne();

        return {
            averageRating: parseFloat(result.averageRating) || 0,
        };
    }
}
