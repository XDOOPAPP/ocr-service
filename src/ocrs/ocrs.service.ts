import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Inject,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ScanOcrDto } from './dto/scan-ocr.dto';
import { QueryOcrDto } from './dto/query-ocr.dto';
import { Prisma } from '@prisma/client';
import { ClientProxy } from '@nestjs/microservices';
import { OcrWorkerService } from './ocr-worker.service';

@Injectable()
export class OcrsService {
  private readonly logger = new Logger(OcrsService.name);

  constructor(
    private prisma: PrismaService,
    @Inject('RABBITMQ_CLIENT') private rabbitClient: ClientProxy,
    private ocrWorker: OcrWorkerService,
  ) { }

  async scan(
    scanOcrDto: ScanOcrDto,
    userId: string,
  ): Promise<Record<string, unknown>> {
    this.logger.log(`[SCAN] Creating job for user ${userId}, fileUrl: ${scanOcrDto.fileUrl}`);

    const job = await this.prisma.ocrJob.create({
      data: {
        userId,
        fileUrl: scanOcrDto.fileUrl,
        status: 'queued',
      },
    });

    this.logger.log(`[SCAN] Job created with ID: ${job.id}`);

    // Emit job to processing queue
    await this.emitJobToQueue(job.id);

    this.logger.log(`[SCAN] Returning job response`);
    return this.transformJob(job);
  }

  async emitJobToQueue(jobId: string): Promise<void> {
    this.logger.log(`[EMIT] Emitting job ${jobId} to processing queue`);

    // Process job asynchronously (don't await to return response quickly)
    setImmediate(() => {
      this.logger.log(`[EMIT] setImmediate callback executing for job ${jobId}`);
      this.ocrWorker.processOcrJob(jobId).catch((error) => {
        this.logger.error(
          `[EMIT] Failed to process job ${jobId}: ${error.message}`,
          error.stack,
        );
      });
    });

    this.logger.log(`[EMIT] setImmediate scheduled for job ${jobId}`);
  }

  async updateJobStatus(
    jobId: string,
    status: string,
    resultJson?: any,
    errorMessage?: string,
  ): Promise<void> {
    await this.prisma.ocrJob.update({
      where: { id: jobId },
      data: {
        status,
        ...(resultJson && { resultJson }),
        ...(errorMessage && { errorMessage }),
        ...(status === 'completed' || status === 'failed'
          ? { completedAt: new Date() }
          : {}),
      },
    });
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

  // ========== ADMIN METHODS ==========

  async getAdminStats(): Promise<Record<string, unknown>> {
    const [totalJobs, byStatus, recentJobs] = await Promise.all([
      this.prisma.ocrJob.count(),
      this.prisma.ocrJob.groupBy({
        by: ['status'],
        _count: true,
      }),
      this.prisma.ocrJob.findMany({
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    // Get unique users
    const uniqueUsers = await this.prisma.ocrJob.groupBy({
      by: ['userId'],
    });

    // Calculate success rate
    const completedCount = byStatus.find((s) => s.status === 'completed')?._count || 0;
    const failedCount = byStatus.find((s) => s.status === 'failed')?._count || 0;
    const successRate = totalJobs > 0
      ? ((completedCount / (completedCount + failedCount)) * 100).toFixed(2)
      : 0;

    return {
      totalJobs,
      totalUsers: uniqueUsers.length,
      successRate: parseFloat(successRate as string),
      byStatus: byStatus.map((item) => ({
        status: item.status,
        count: item._count,
      })),
      recentJobs: recentJobs.map((job) => this.transformJob(job)),
    };
  }
}
