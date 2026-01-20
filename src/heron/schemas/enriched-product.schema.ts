// heron/schemas/enriched-product.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type EnrichedProductDocument = EnrichedProduct & Document;

@Schema({ collection: 'enriched_products' })
export class EnrichedProduct {
  @Prop({ required: true })
  sku: string;
  @Prop({ required: true })
  name: string;
  @Prop()
  price: number;
  @Prop()
  stock: number;
  @Prop()
  manufacturer: string;
  @Prop()
  category: string;
  @Prop()
  subCategory: string;
  @Prop()
  atcGmp: string;
  @Prop()
  weight: number;
  @Prop()
  published: boolean;
  @Prop()
  shippingCost: number;
  @Prop()
  iva: number;
  @Prop()
  farmamediaData?: any; // Dati Farmamedia
  @Prop()
  supplierCode?: string; // Codice fornitore selezionato
  @Prop()
  supplierPrice?: number; // Prezzo fornitore
  @Prop({ required: true })
  customerId: string;
  @Prop({ default: Date.now })
  importedAt: Date;
}

export const EnrichedProductSchema = SchemaFactory.createForClass(EnrichedProduct);
