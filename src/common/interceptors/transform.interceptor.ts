import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface Response<T> {
  data: T;
  meta?: Record<string, unknown>;
}

@Injectable()
export class TransformInterceptor<T> implements NestInterceptor<
  T,
  Response<T>
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    return next.handle().pipe(
      map((data: unknown): Response<T> => {
        // If data already has the response structure, return it
        if (data && typeof data === 'object' && 'data' in data) {
          return data as Response<T>;
        }

        // Otherwise wrap it
        return {
          data: data as T,
          meta: {
            timestamp: new Date().toISOString(),
          },
        };
      }),
    );
  }
}
