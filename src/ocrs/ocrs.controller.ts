import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { OcrsService } from './ocrs.service';
import { CreateOcrDto } from './dto/create-ocr.dto';
import { UpdateOcrDto } from './dto/update-ocr.dto';

@Controller()
export class OcrsController {
  constructor(private readonly ocrsService: OcrsService) {}

  @MessagePattern('createOcr')
  create(@Payload() createOcrDto: CreateOcrDto) {
    return this.ocrsService.create(createOcrDto);
  }

  @MessagePattern('findAllOcrs')
  findAll() {
    return this.ocrsService.findAll();
  }

  @MessagePattern('findOneOcr')
  findOne(@Payload() id: number) {
    return this.ocrsService.findOne(id);
  }

  @MessagePattern('updateOcr')
  update(@Payload() updateOcrDto: UpdateOcrDto) {
    return this.ocrsService.update(updateOcrDto.id, updateOcrDto);
  }

  @MessagePattern('removeOcr')
  remove(@Payload() id: number) {
    return this.ocrsService.remove(id);
  }
}
