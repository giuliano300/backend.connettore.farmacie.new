import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type RawHeronProductDocument = RawHeronProduct & Document;

@Schema({ collection: 'raw_heron_products' })
export class RawHeronProduct {
  @Prop({ required: true })
  sku: string;           // CodiceAIC
  @Prop({ required: true })
  name: string;          // Nome
  @Prop()
  price: number;         // PrezzoEShop
  @Prop()
  stock: number;         // Giacenza
  @Prop()
  manufacturer: string;  // Produttore
  @Prop()
  category: string;      // Categoria
  @Prop()
  subCategory: string;   // SottoCategoria
  @Prop()
  atcGmp: string;        // ATC_GMP
  @Prop()
  weight: number;        // Peso
  @Prop()
  published: boolean;    // Pubblicato
  @Prop()
  shippingCost: number;  // SpeseSpedizioneAggiuntive
  @Prop()
  iva: number;           // Iva
  @Prop({ required: true })
  customerId: string;
  @Prop({ default: Date.now })
  importedAt: Date;
}

export const RawHeronProductSchema =
  SchemaFactory.createForClass(RawHeronProduct);
