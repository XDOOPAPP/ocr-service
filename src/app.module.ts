import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { OcrsModule } from './ocrs/ocrs.module';

@Module({
  imports: [PrismaModule, OcrsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
