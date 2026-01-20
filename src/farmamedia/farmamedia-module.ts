import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { FarmamediaService } from './farmamedia.service';
import { FarmamediaController } from './farmamedia.controller';
import { Farmamedia, FarmamediaSchema } from './schemas/farmamedia.schema';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Farmamedia.name, schema: FarmamediaSchema }]),
    HttpModule
  ],
  providers: [FarmamediaService],
  controllers: [FarmamediaController],
})
export class FarmamediaModule {}
