import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClientProxy } from '@nestjs/microservices';
import { Inject } from '@nestjs/common';
import * as Tesseract from 'tesseract.js';
import axios from 'axios';
import jsQR from 'jsqr';
import sharp from 'sharp';
import {
    OcrResult,
    ExpenseData,
    OcrCompletedEvent,
    OcrJobStatus,
} from './types/ocr-types';

@Injectable()
export class OcrWorkerService {
    private readonly logger = new Logger(OcrWorkerService.name);

    constructor(
        private prisma: PrismaService,
        @Inject('RABBITMQ_CLIENT') private rabbitClient: ClientProxy,
    ) { }

    async processOcrJob(jobId: string): Promise<void> {
        this.logger.log(`Starting OCR processing for job ${jobId}`);

        try {
            // Update status to processing
            await this.updateJobStatus(jobId, OcrJobStatus.PROCESSING);

            // Get job details
            const job = await this.prisma.ocrJob.findUnique({
                where: { id: jobId },
            });

            if (!job) {
                throw new Error(`Job ${jobId} not found`);
            }

            // Download image once
            const imageBuffer = await this.downloadImage(job.fileUrl);

            // Try QR detection first (QR-first approach)
            let ocrResult: OcrResult;
            let expenseData: ExpenseData;

            try {
                this.logger.log('Attempting QR code detection...');
                const qrResult = await this.detectAndDecodeQR(imageBuffer);

                if (qrResult && qrResult.parsedData) {
                    this.logger.log('QR code detected and parsed successfully');

                    // Convert QR data to expense data
                    expenseData = this.qrToExpenseData(qrResult);

                    ocrResult = {
                        text: qrResult.rawData,
                        confidence: qrResult.confidence,
                        hasQrCode: true,
                        qrData: qrResult,
                    };
                } else {
                    throw new Error('QR not found or parsing failed');
                }
            } catch (qrError) {
                // Fallback to OCR
                this.logger.log(
                    `QR detection failed: ${qrError.message}. Falling back to OCR...`,
                );

                ocrResult = await this.performOcrOnBuffer(imageBuffer);
                this.logger.log(
                    `OCR completed with confidence: ${ocrResult.confidence}%`,
                );

                // Parse OCR text to extract expense data
                expenseData = await this.parseOcrText(
                    ocrResult.text,
                    ocrResult.confidence,
                );
                expenseData.source = 'ocr';
            }

            this.logger.log(`Parsed expense data: ${JSON.stringify(expenseData)}`);

            // Save result to database
            await this.prisma.ocrJob.update({
                where: { id: jobId },
                data: {
                    status: OcrJobStatus.COMPLETED,
                    resultJson: JSON.parse(JSON.stringify({
                        rawText: ocrResult.text,
                        confidence: ocrResult.confidence,
                        hasQrCode: ocrResult.hasQrCode || false,
                        qrData: ocrResult.qrData || null,
                        expenseData: {
                            amount: expenseData.amount,
                            description: expenseData.description,
                            spentAt: expenseData.spentAt.toISOString(),
                            category: expenseData.category,
                            confidence: expenseData.confidence,
                            source: expenseData.source,
                        },
                    })),
                    completedAt: new Date(),
                },
            });

            // Emit event to expense service
            await this.emitOcrCompleted(jobId, job.userId, expenseData, job.fileUrl);

            this.logger.log(`Job ${jobId} completed successfully`);
        } catch (error) {
            this.logger.error(`Job ${jobId} failed: ${error.message}`, error.stack);

            await this.prisma.ocrJob.update({
                where: { id: jobId },
                data: {
                    status: OcrJobStatus.FAILED,
                    errorMessage: error.message,
                    completedAt: new Date(),
                },
            });
        }
    }

    private async downloadImage(fileUrl: string): Promise<Buffer> {
        this.logger.log(`Downloading image from: ${fileUrl}`);

        try {
            const response = await axios.get(fileUrl, {
                responseType: 'arraybuffer',
                timeout: 30000, // 30 seconds timeout
            });

            return Buffer.from(response.data);
        } catch (error) {
            throw new Error(`Failed to download image: ${error.message}`);
        }
    }

    private async performOcr(fileUrl: string): Promise<OcrResult> {
        const imageBuffer = await this.downloadImage(fileUrl);
        return this.performOcrOnBuffer(imageBuffer);
    }

    private async performOcrOnBuffer(imageBuffer: Buffer): Promise<OcrResult> {
        this.logger.log('Running Tesseract OCR...');

        try {
            const result = await Tesseract.recognize(imageBuffer, 'eng+vie', {
                logger: (m) => {
                    if (m.status === 'recognizing text') {
                        this.logger.debug(`OCR Progress: ${(m.progress * 100).toFixed(1)}%`);
                    }
                },
            });

            return {
                text: result.data.text,
                confidence: result.data.confidence,
                hasQrCode: false,
            };
        } catch (error) {
            throw new Error(`Failed to perform OCR: ${error.message}`);
        }
    }

    private async detectAndDecodeQR(imageBuffer: Buffer): Promise<import('./types/ocr-types').QrResult | null> {
        this.logger.log('Detecting QR code in image...');

        try {
            // Convert image to raw pixel data using sharp
            const { data, info } = await sharp(imageBuffer)
                .ensureAlpha()
                .raw()
                .toBuffer({ resolveWithObject: true });

            // Detect QR code
            const qrCode = jsQR(
                new Uint8ClampedArray(data),
                info.width,
                info.height,
            );

            if (!qrCode) {
                this.logger.log('No QR code detected in image');
                return null;
            }

            this.logger.log(`QR code detected: ${qrCode.data.substring(0, 50)}...`);

            // Parse Vietnamese invoice format
            const parsedData = this.parseVietnameseInvoiceQR(qrCode.data);

            return {
                rawData: qrCode.data,
                confidence: 98, // QR codes have very high confidence
                parsedData,
            };
        } catch (error) {
            this.logger.warn(`QR detection error: ${error.message}`);
            return null;
        }
    }

    private parseVietnameseInvoiceQR(qrData: string): import('./types/ocr-types').VietnameseInvoiceQR | undefined {
        this.logger.log('Parsing Vietnamese invoice QR format...');

        try {
            // Vietnamese e-invoice QR format (pipe-separated):
            // <Mẫu số>|<Ký hiệu>|<Số HĐ>|<Ngày>|<MST người bán>|<Tên người bán>|<MST người mua>|<Tên người mua>|<Tổng tiền>|<Thuế>|<Tổng thanh toán>|<Mã tra cứu>
            const parts = qrData.split('|');

            if (parts.length < 9) {
                this.logger.warn('QR data does not match Vietnamese invoice format');
                return undefined;
            }

            const parsed: import('./types/ocr-types').VietnameseInvoiceQR = {
                invoiceForm: parts[0]?.trim() || undefined,
                invoiceSerial: parts[1]?.trim() || undefined,
                invoiceNumber: parts[2]?.trim() || undefined,
                invoiceDate: parts[3]?.trim() || undefined,
                sellerTaxCode: parts[4]?.trim() || undefined,
                sellerName: parts[5]?.trim() || undefined,
                buyerTaxCode: parts[6]?.trim() || undefined,
                buyerName: parts[7]?.trim() || undefined,
                totalAmount: this.parseAmount(parts[8]),
                taxAmount: this.parseAmount(parts[9]),
                totalPayment: this.parseAmount(parts[10]),
                lookupCode: parts[11]?.trim() || undefined,
            };

            this.logger.log(`Parsed invoice: ${parsed.invoiceNumber} - ${parsed.totalPayment} VND`);
            return parsed;
        } catch (error) {
            this.logger.error(`Failed to parse QR data: ${error.message}`);
            return undefined;
        }
    }

    private parseAmount(amountStr: string | undefined): number | undefined {
        if (!amountStr) return undefined;

        try {
            // Remove all non-numeric characters except decimal point
            const cleaned = amountStr.replace(/[^0-9.]/g, '');
            const amount = parseFloat(cleaned);
            return isNaN(amount) ? undefined : amount;
        } catch {
            return undefined;
        }
    }

    private qrToExpenseData(qrResult: import('./types/ocr-types').QrResult): ExpenseData {
        const parsed = qrResult.parsedData;

        if (!parsed) {
            throw new Error('QR data not parsed');
        }

        // Use totalPayment (including tax) as the amount
        const amount = parsed.totalPayment || parsed.totalAmount || 0;

        // Create description from seller name and invoice number
        let description = 'Hóa đơn điện tử';
        if (parsed.sellerName) {
            description = `${parsed.sellerName}`;
        }
        if (parsed.invoiceNumber) {
            description += ` - ${parsed.invoiceNumber}`;
        }

        // Parse date
        let spentAt = new Date();
        if (parsed.invoiceDate) {
            // Try to parse Vietnamese date format (DD/MM/YYYY)
            const dateParts = parsed.invoiceDate.split('/');
            if (dateParts.length === 3) {
                const day = parseInt(dateParts[0], 10);
                const month = parseInt(dateParts[1], 10) - 1; // Month is 0-indexed
                const year = parseInt(dateParts[2], 10);
                spentAt = new Date(year, month, day);
            }
        }

        return {
            amount,
            description,
            spentAt,
            category: undefined, // Will be categorized later
            confidence: qrResult.confidence,
            source: 'qr',
        };
    }


    private async parseOcrText(
        text: string,
        confidence: number,
    ): Promise<ExpenseData> {
        this.logger.log('Parsing OCR text to extract expense data...');

        // Regular expressions for parsing
        const amountRegex = /(?:total|amount|tổng|thanh toán)[:\s]*([0-9,\.]+)/i;
        const dateRegex = /(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/;
        const currencyRegex = /([0-9,\.]+)\s*(?:đ|vnd|₫|usd|\$)/i;

        // Extract amount
        let amount = 0;
        const amountMatch = text.match(amountRegex) || text.match(currencyRegex);
        if (amountMatch) {
            const amountStr = amountMatch[1].replace(/[,\.]/g, '');
            amount = parseFloat(amountStr) || 0;
        }

        // Extract date
        let spentAt = new Date();
        const dateMatch = text.match(dateRegex);
        if (dateMatch) {
            const parsedDate = new Date(dateMatch[1]);
            if (!isNaN(parsedDate.getTime())) {
                spentAt = parsedDate;
            }
        }

        // Extract description (first non-empty line or fallback)
        const lines = text.split('\n').filter((line) => line.trim().length > 0);
        const description = lines[0]?.trim() || 'OCR Scanned Receipt';

        // Try to detect category from keywords
        const category = this.detectCategory(text);

        return {
            amount,
            description,
            spentAt,
            category,
            confidence,
            source: 'ocr',
        };
    }

    private detectCategory(text: string): string | undefined {
        const lowerText = text.toLowerCase();

        const categories = [
            { keywords: ['food', 'restaurant', 'cafe', 'coffee', 'đồ ăn', 'nhà hàng', 'quán'], name: 'food' },
            { keywords: ['transport', 'taxi', 'grab', 'uber', 'xe'], name: 'transport' },
            { keywords: ['shopping', 'store', 'market', 'mua sắm', 'siêu thị'], name: 'shopping' },
            { keywords: ['health', 'hospital', 'pharmacy', 'y tế', 'bệnh viện'], name: 'health' },
            { keywords: ['entertainment', 'movie', 'cinema', 'giải trí'], name: 'entertainment' },
        ];

        for (const cat of categories) {
            if (cat.keywords.some((keyword) => lowerText.includes(keyword))) {
                return cat.name;
            }
        }

        return undefined;
    }

    private async emitOcrCompleted(
        jobId: string,
        userId: string,
        expenseData: ExpenseData,
        fileUrl: string,
    ): Promise<void> {
        const event: OcrCompletedEvent = {
            jobId,
            userId,
            expenseData,
            fileUrl,
        };

        this.logger.log(`Emitting ocr.completed event for job ${jobId}`);
        this.rabbitClient.emit('ocr.completed', event);
    }

    private async updateJobStatus(
        jobId: string,
        status: OcrJobStatus,
    ): Promise<void> {
        await this.prisma.ocrJob.update({
            where: { id: jobId },
            data: { status },
        });
    }
}
