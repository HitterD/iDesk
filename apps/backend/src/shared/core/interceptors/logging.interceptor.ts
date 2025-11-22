import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger(LoggingInterceptor.name);

    intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
        const req = context.switchToHttp().getRequest();
        const { method, url } = req;
        const now = Date.now();

        return next.handle().pipe(
            tap(() => {
                const user = req.user ? `User: ${req.user.userId}` : 'Guest';
                const ip = req.ip || req.connection.remoteAddress;
                const duration = Date.now() - now;

                this.logger.log(
                    `[${method}] ${url} - ${user} - IP: ${ip} - Duration: ${duration}ms`,
                );
            }),
        );
    }
}
