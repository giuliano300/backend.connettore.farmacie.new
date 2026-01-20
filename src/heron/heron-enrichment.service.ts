import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { RawHeronProduct, RawHeronProductDocument } from './schemas/raw-heron-product.schema';
import { EnrichedProduct, EnrichedProductDocument } from './schemas/enriched-product.schema';
import * as fs from 'fs';
import { Supplier } from 'src/interfaces/supplier';
import { FarmamediaService } from 'src/farmamedia/farmamedia.service';

@Injectable()
export class HeronEnrichmentService {
  private readonly logger = new Logger(HeronEnrichmentService.name);

  constructor(
    @InjectModel(RawHeronProduct.name) private readonly rawModel: Model<RawHeronProductDocument>,
    @InjectModel(EnrichedProduct.name) private readonly enrichedModel: Model<EnrichedProductDocument>,
    private readonly farmamediaService: FarmamediaService
  ) {}

  /**
   * Arricchisce i RawHeronProduct e seleziona il miglior fornitore
   * @param customerId 
   * @param supplierFilePath File CSV o JSON dei fornitori
   */
  async enrichProducts(customerId: string, supplierFilePath: string): Promise<void> {
    const rawProducts = await this.rawModel.find({ customerId });
    if (!rawProducts.length) {
      this.logger.warn(`Nessun Raw Heron Product per customer ${customerId}`);
      return;
    }

    // 1️⃣ Leggi file fornitori
    let suppliers: Supplier[] = [];
    if (fs.existsSync(supplierFilePath)) {
      const content = fs.readFileSync(supplierFilePath, 'utf-8');
      suppliers = JSON.parse(content); // supponiamo JSON { sku, supplierCode, price, stock }
    }

    // 2️⃣ Pulizia vecchi dati fornitori (riscrittura)
    await this.enrichedModel.deleteMany({ customerId });

    // 3️⃣ Arricchimento
    const enrichedPromises = rawProducts.map(async p => {
    const farmData = await this.farmamediaService.getByAIC(p.sku);

    const supplierMatches = suppliers.filter(s => s.sku === p.sku);
    let bestSupplier: Supplier | null = null;
    if (supplierMatches.length) {
        bestSupplier = supplierMatches
        .filter(s => s.stock > 0)
        .sort((a, b) => a.price - b.price)[0];
    }

    return {
        sku: p.sku,
        name: p.name,
        price: p.price,
        stock: bestSupplier ? bestSupplier.stock! : p.stock,
        manufacturer: p.manufacturer,
        category: p.category,
        subCategory: p.subCategory,
        atcGmp: p.atcGmp,
        weight: p.weight,
        published: p.published,
        shippingCost: p.shippingCost,
        iva: p.iva,
        farmamediaData: farmData,
        supplierCode: bestSupplier?.supplierCode,
        supplierPrice: bestSupplier?.price,
        customerId: p.customerId,
        importedAt: new Date(),
    };
    });

    // Risolvi tutte le promesse
    const enriched: Partial<EnrichedProduct>[] = await Promise.all(enrichedPromises);
    // 4️⃣ Salvataggio temporaneo EnrichedProduct
    await this.enrichedModel.insertMany(enriched);
    this.logger.log(`Enriched ${enriched.length} prodotti per customer ${customerId}`);
  }

  /**
   * Recupera tutti i prodotti arricchiti per un customer
   */
  async getEnrichedProducts(customerId: string): Promise<EnrichedProduct[]> {
    return this.enrichedModel.find({ customerId }).exec();
  }

  /**
   * Elimina tutti i prodotti arricchiti per un customer
   */
  async clearEnrichedProducts(customerId: string): Promise<void> {
    await this.enrichedModel.deleteMany({ customerId });
    this.logger.log(`EnrichedProducts cancellati per customer ${customerId}`);
  }
  
}
