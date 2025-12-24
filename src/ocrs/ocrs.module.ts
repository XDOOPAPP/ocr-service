import { Module } from '@nestjs/common';
import { OcrsService } from './ocrs.service';
import { OcrsController } from './ocrs.controller';

@Module({
  controllers: [OcrsController],
  providers: [OcrsService],
})
export class OcrsModule {}
