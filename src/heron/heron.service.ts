import { Injectable, Logger } from '@nestjs/common';
import { RawHeronProduct, RawHeronProductDocument } from './schemas/raw-heron-product.schema';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as fs from 'fs';
import * as crypto from 'crypto';
import { parseStringPromise } from 'xml2js';

@Injectable()
export class HeronService {
  private readonly logger = new Logger(HeronService.name);

  constructor(
    @InjectModel(RawHeronProduct.name)
    private readonly rawHeronProductModel: Model<RawHeronProductDocument>,
  ) {}

  /**
   * Parse XML di Heron e salva i prodotti in RawHeronProduct
   */
  async parseAndSave(filePath: string, customerId: string): Promise<void> {
    try {
      const xmlContent = fs.readFileSync(filePath, 'utf-8');

      // Hash file
      const fileHash = crypto.createHash('sha256').update(xmlContent).digest('hex');

      // Controllo duplicati (basato su customer + hash)
      const existing = await this.rawHeronProductModel.findOne({ customerId, sku: fileHash });
      if (existing) {
        this.logger.warn(`File già importato per customer ${customerId}`);
        return;
      }

      // Parsing XML
      const parsedXml = await parseStringPromise(xmlContent, { explicitArray: false });
      const prodotti = parsedXml.Prodotti?.Prodotto;
      if (!prodotti) {
        this.logger.warn(`Nessun prodotto trovato nel file ${filePath}`);
        return;
      }

      const rawProducts: Partial<RawHeronProduct>[] = (Array.isArray(prodotti) ? prodotti : [prodotti])
        .map(p => ({
          sku: p.CodiceAIC,
          name: p.Nome,
          price: parseFloat(p.PrezzoEShop.replace(',', '.')),
          stock: parseInt(p.Giacenza, 10),
          manufacturer: p.Produttore,
          category: p.Categoria,
          subCategory: p.SottoCategoria,
          atcGmp: p.ATC_GMP,
          weight: parseInt(p.Peso, 10),
          published: p.Pubblicato === 'True',
          shippingCost: parseFloat(p.SpeseSpedizioneAggiuntive.replace(',', '.')),
          iva: parseInt(p.Iva, 10),
          customerId,
          importedAt: new Date(),
        }));

      await this.rawHeronProductModel.insertMany(rawProducts);
      this.logger.log(`Salvati ${rawProducts.length} prodotti per customer ${customerId}`);
    } catch (error) {
      this.logger.error(`Errore parsing file ${filePath} per customer ${customerId}: ${error.message}`);
      throw error;
    }
  }
  
 /**
   * Recupera tutti i prodotti raw per un customer
   */
  async getRawProducts(customerId: string): Promise<RawHeronProduct[]> {
    return this.rawHeronProductModel.find({ customerId }).exec();
  }

  /**
   * Elimina tutti i prodotti raw per un customer
   */
  async clearRawProducts(customerId: string): Promise<void> {
    await this.rawHeronProductModel.deleteMany({ customerId });
    this.logger.log(`RawHeronProduct cancellati per customer ${customerId}`);
  }
}
