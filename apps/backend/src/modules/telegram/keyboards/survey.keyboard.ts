import { Markup } from 'telegraf';
import { getTemplates } from '../templates';

export class SurveyKeyboard {
    static build(ticketId: string, lang: string = 'id') {
        const t = getTemplates(lang);
        
        return Markup.inlineKeyboard([
            [
                Markup.button.callback(t.survey.ratings.excellent, `survey_rating:${ticketId}:5`),
                Markup.button.callback(t.survey.ratings.good, `survey_rating:${ticketId}:4`),
            ],
            [
                Markup.button.callback(t.survey.ratings.neutral, `survey_rating:${ticketId}:3`),
                Markup.button.callback(t.survey.ratings.poor, `survey_rating:${ticketId}:2`),
            ],
            [Markup.button.callback(t.survey.skip, `skip_survey:${ticketId}`)],
        ]);
    }
}
