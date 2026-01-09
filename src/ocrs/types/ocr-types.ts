export interface OcrResult {
    text: string;
    confidence: number;
    hasQrCode?: boolean;
    qrData?: QrResult;
}

export interface QrResult {
    rawData: string;
    confidence: number;
    parsedData?: VietnameseInvoiceQR;
}

export interface VietnameseInvoiceQR {
    invoiceForm?: string;        // Mẫu số hóa đơn
    invoiceSerial?: string;      // Ký hiệu hóa đơn
    invoiceNumber?: string;      // Số hóa đơn
    invoiceDate?: string;        // Ngày hóa đơn
    sellerTaxCode?: string;      // MST người bán
    sellerName?: string;         // Tên người bán
    buyerTaxCode?: string;       // MST người mua
    buyerName?: string;          // Tên người mua
    totalAmount?: number;        // Tổng tiền trước thuế
    taxAmount?: number;          // Tiền thuế
    totalPayment?: number;       // Tổng thanh toán
    lookupCode?: string;         // Mã tra cứu
}

export interface ExpenseData {
    amount: number;
    description: string;
    spentAt: Date;
    category?: string;
    confidence: number;
    source?: 'qr' | 'ocr' | 'hybrid'; // Nguồn dữ liệu
}

export interface OcrCompletedEvent {
    jobId: string;
    userId: string;
    expenseData: ExpenseData;
    fileUrl: string;
}

export enum OcrJobStatus {
    QUEUED = 'queued',
    PROCESSING = 'processing',
    COMPLETED = 'completed',
    FAILED = 'failed',
}
