import { Injectable, Logger, Scope } from '@nestjs/common';

@Injectable({ scope: Scope.TRANSIENT })
export class AppLogger extends Logger {
    private isProduction = process.env.NODE_ENV === 'production';

    debug(message: string, context?: string) {
        if (!this.isProduction) {
            super.debug(message, context);
        }
    }

    verbose(message: string, context?: string) {
        if (!this.isProduction) {
            super.verbose(message, context);
        }
    }

    log(message: string, context?: string) {
        super.log(message, context);
    }

    warn(message: string, context?: string) {
        super.warn(message, context);
    }

    error(message: string, trace?: string, context?: string) {
        super.error(message, trace, context);
    }
}
