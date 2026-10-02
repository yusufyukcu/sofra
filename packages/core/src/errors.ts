/** İş kuralı ihlallerini API katmanına taşıyan hata tipi. */
export class DomainError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "DomainError";
    this.code = code;
    this.status = status;
  }
}
