import { Catch, RpcExceptionFilter as NestRpcExceptionFilter, ArgumentsHost, HttpException, HttpStatus } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { RpcException } from '@nestjs/microservices';

@Catch()
export class RpcExceptionFilter implements NestRpcExceptionFilter<any> {
    catch(exception: any, host: ArgumentsHost): Observable<any> {
        // LOG ERROR FOR DEBUGGING
        console.error('🔥 RPC Exception Caught:', exception);

        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let message: string | string[] = 'Internal server error';
        let errors: any = null;

        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const response = exception.getResponse();
            if (typeof response === 'object' && response !== null) {
                message = (response as any).message || exception.message;
                errors = (response as any).errors || null;
            } else {
                message = exception.message;
            }
        } else if (exception instanceof Error) {
            message = exception.message;
        }

        // Wrap in RpcException to be sent back to client
        return throwError(() => new RpcException({
            statusCode: status,
            message,
            errors,
            timestamp: new Date().toISOString(),
        }));
    }
}
