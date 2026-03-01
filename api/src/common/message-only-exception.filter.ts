import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Response } from 'express';

function extractMessage(payload: unknown): string {
  if (typeof payload === 'string') return payload;
  if (Array.isArray(payload)) return String(payload[0] ?? 'Erro inesperado');
  if (payload && typeof payload === 'object') {
    const body = payload as { message?: unknown };
    if (Array.isArray(body.message)) {
      return String(body.message[0] ?? 'Erro inesperado');
    }
    if (typeof body.message === 'string') return body.message;
  }
  return 'Erro inesperado';
}

@Catch()
export class MessageOnlyExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const payload = exception.getResponse();
      response
        .status(status)
        .type('text/plain; charset=utf-8')
        .send(extractMessage(payload));
      return;
    }

    response
      .status(HttpStatus.INTERNAL_SERVER_ERROR)
      .type('text/plain; charset=utf-8')
      .send('Erro interno do servidor');
  }
}
