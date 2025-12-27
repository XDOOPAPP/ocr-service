import { Module } from '@nestjs/common';
import { OcrsService } from './ocrs.service';
import { OcrsController } from './ocrs.controller';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [OcrsController],
  providers: [OcrsService],
})
export class OcrsModule { }
