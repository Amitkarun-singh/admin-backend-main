export class AppError extends Error {
  status;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}
