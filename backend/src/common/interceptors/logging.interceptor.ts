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
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = context.getType();
    
    if (type !== 'http') {
      return next.handle();
    }
    
    const request = context.switchToHttp().getRequest();
    const { method, url, originalUrl } = request;
    const requestUrl = originalUrl || url;
    const timestamp = new Date().toISOString();

    return next.handle().pipe(
      tap({
        next: () => {
          const response = context.switchToHttp().getResponse();
          this.logger.log(`[HTTP ${timestamp}] ${method} ${requestUrl} - ${response.statusCode}`);
        },
        error: (error) => {
          this.logger.error(`[HTTP ${timestamp}] ${method} ${requestUrl} - ERROR: ${error.message}`);
        },
      }),
    );
  }
}

