import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { FarmamediaModule } from './farmamedia/farmamedia-module';
import { MongooseModule } from '@nestjs/mongoose';
import { HttpModule } from '@nestjs/axios';

@Module({
 imports: [
    MongooseModule.forRoot('mongodb://localhost:27017/heron-migration'),
    FarmamediaModule,
    HttpModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
