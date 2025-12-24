import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { OrcsModule } from './orcs/orcs.module';
import { OcrsModule } from './ocrs/ocrs.module';

@Module({
  imports: [OrcsModule, OcrsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
