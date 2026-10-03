export class AppError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (message, details) => new AppError(400, 'VALIDATION_ERROR', message, details);
export const unauthorized = (message = 'Avtorizatsiya talab qilinadi') => new AppError(401, 'UNAUTHORIZED', message);
export const forbidden = (message = 'Ruxsat yo‘q') => new AppError(403, 'FORBIDDEN', message);
export const notFound = (message = 'Topilmadi') => new AppError(404, 'NOT_FOUND', message);
export const conflict = (code, message, details) => new AppError(409, code, message, details);
export const invalidEntity = (code, message, details) => new AppError(422, code, message, details);
