// farmamedia/schemas/farmamedia.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type FarmamediaDocument = Farmamedia & Document;

@Schema({ collection: 'farmamedia_cache' })
export class Farmamedia {
  @Prop({ required: true, unique: true })
  aic: string;

  @Prop({ required: true })
  name: string;

  @Prop()
  shortDescription: string;

  @Prop()
  longDescription: string;

  @Prop({ type: [String], default: [] })
  images: string[];

  @Prop({ default: Date.now })
  updatedAt: Date; // Ultimo aggiornamento

  @Prop({ type: MongooseSchema.Types.Mixed })
  data: Record<string, any>;
}

export const FarmamediaSchema = SchemaFactory.createForClass(Farmamedia);
