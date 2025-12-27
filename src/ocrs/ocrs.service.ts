import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanOcrDto } from './dto/scan-ocr.dto';
import { QueryOcrDto } from './dto/query-ocr.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class OcrsService {
  constructor(private prisma: PrismaService) { }

  async scan(
    scanOcrDto: ScanOcrDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const job = await this.prisma.ocrJob.create({
      data: {
        userId,
        fileUrl: scanOcrDto.fileUrl,
        status: 'queued',
      },
    });

    return this.transformJob(job);
  }

  async findHistory(
    query: QueryOcrDto,
    userId: string,
  ): Promise<{
    data: Record<string, unknown>[];
    meta: Record<string, unknown>;
  }> {
    const { status, page = 1, limit = 10 } = query;

    // Build where clause
    const where: Prisma.OcrJobWhereInput = {
      userId,
      ...(status && { status }),
    };

    // Execute queries in parallel
    const [jobs, total] = await Promise.all([
      this.prisma.ocrJob.findMany({
        where,
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ocrJob.count({ where }),
    ]);

    return {
      data: jobs.map((job) => this.transformJob(job)),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        timestamp: new Date().toISOString(),
      },
    };
  }

  async findOne(
    jobId: string,
    userId: string,
  ): Promise<Record<string, unknown>> {
    const job = await this.prisma.ocrJob.findUnique({
      where: { id: jobId },
    });

    if (!job) {
      throw new NotFoundException(`OCR job with ID ${jobId} not found`);
    }

    // Check ownership
    if (job.userId !== userId) {
      throw new ForbiddenException('You do not have access to this OCR job');
    }

    return this.transformJob(job);
  }

  private transformJob(
    job: Prisma.OcrJobGetPayload<object>,
  ): Record<string, unknown> {
    return {
      id: job.id,
      userId: job.userId,
      status: job.status,
      fileUrl: job.fileUrl,
      resultJson: job.resultJson,
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString() || null,
    };
  }
}
