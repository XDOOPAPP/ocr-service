import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OcrsService } from './ocrs.service';
import { ScanOcrDto } from './dto/scan-ocr.dto';
import { QueryOcrDto } from './dto/query-ocr.dto';

@Controller()
export class OcrsController {
  constructor(private readonly ocrsService: OcrsService) { }

  @MessagePattern('ocr.scan')
  async scan(@Payload() payload: ScanOcrDto & { userId: string }) {
    const { userId, ...dto } = payload;
    return this.ocrsService.scan(dto, userId);
  }

  @MessagePattern('ocr.history')
  async getHistory(@Payload() payload: QueryOcrDto & { userId: string }) {
    const { userId, ...query } = payload;
    return this.ocrsService.findHistory(query, userId);
  }

  @MessagePattern('ocr.find_one')
  async findOne(@Payload() payload: { jobId: string; userId: string }) {
    const { jobId, userId } = payload;
    return this.ocrsService.findOne(jobId, userId);
  }
}
