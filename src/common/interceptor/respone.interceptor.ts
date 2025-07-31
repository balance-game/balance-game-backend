import { Injectable, NestInterceptor, ExecutionContext,CallHandler } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req: Request = context.switchToHttp().getRequest();
    const res: Response = context.switchToHttp().getResponse();

    return next.handle().pipe(
      map((data) => {
        return {
          statusCode: res.statusCode,
          path: req.originalUrl,
          message: data?.message ?? '요청에 성공했습니다.',
          data: data,
        };
      }),
    );
  }
}
