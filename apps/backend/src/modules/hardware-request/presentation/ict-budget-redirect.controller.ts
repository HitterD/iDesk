import { All, Controller, Logger, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';

@Controller('ict-budget')
export class IctBudgetRedirectController {
    private readonly logger = new Logger(IctBudgetRedirectController.name);

    @All()
    redirectRoot(@Req() req: Request, @Res() res: Response) {
        return this.doRedirect(req, res);
    }

    @All('*path')
    redirectSub(@Req() req: Request, @Res() res: Response) {
        return this.doRedirect(req, res);
    }

    private doRedirect(req: Request, res: Response) {
        // originalUrl keeps the version prefix (/v1/ict-budget/...): swap only the segment, else it redirects to itself.
        const newPath = req.originalUrl.replace(/\/ict-budget(?=\/|\?|$)/, '/hardware-requests');
        this.logger.warn(`Deprecated /ict-budget call → ${newPath}`);
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', '2026-07-01');
        res.setHeader('Link', '</hardware-requests>; rel="successor-version"');
        return res.redirect(308, newPath);
    }
}
