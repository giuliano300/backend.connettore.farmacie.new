import { Processor, Process } from '@nestjs/bull';
import type { Job } from 'bull';
import { HeronService } from '../heron/heron.service';
import { HeronEnrichmentService } from '../heron/heron-enrichment.service';
import { Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Processor('customer-jobs')
export class JobsProcessor {
  private readonly logger = new Logger(JobsProcessor.name);

  constructor(
    private readonly heronService: HeronService,
    private readonly enrichmentService: HeronEnrichmentService,
  ) {}

  @Process()
  async handleJob(job: Job<{ customerId: string; filePath: string; fileName: string; supplierFilePath: string }>) {
    const { customerId, filePath, fileName, supplierFilePath } = job.data;

    try {
      this.logger.log(`Inizio elaborazione file ${fileName} per customer ${customerId}`);

      // 1️⃣ Parsing XML e salvataggio RawHeronProduct
      await this.heronService.parseAndSave(filePath, customerId);

      // 2️⃣ Arricchimento + confronto fornitori
      await this.enrichmentService.enrichProducts(customerId, supplierFilePath);

      // 3️⃣ Generazione file Magento
      const enrichedProducts = await this.enrichmentService['enrichedModel'].find({ customerId });

      const outputDir = path.join(path.dirname(filePath), 'worked');
      if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, { recursive: true });

      const outputFile = path.join(outputDir, `${path.basename(fileName, '.xml')}-magento.json`);
      fs.writeFileSync(outputFile, JSON.stringify(enrichedProducts, null, 2), 'utf-8');

      this.logger.log(`File Magento generato: ${outputFile}`);

      // 4️⃣ Cleanup dati temporanei
      await this.enrichmentService['enrichedModel'].deleteMany({ customerId });
      await this.heronService['rawHeronProductModel'].deleteMany({ customerId });

      this.logger.log(`Pulizia dati temporanei completata per customer ${customerId}`);

      // 5️⃣ Spostamento file originale
      const workedDir = path.join(path.dirname(filePath), 'worked');
      if (!fs.existsSync(workedDir)) fs.mkdirSync(workedDir, { recursive: true });
      fs.renameSync(filePath, path.join(workedDir, fileName));

      this.logger.log(`File originale spostato in worked: ${fileName}`);
    } catch (error) {
      this.logger.error(`Errore elaborazione file ${fileName} per customer ${customerId}: ${error.message}`);

      // Sposta file in errore
      const errorDir = path.join(path.dirname(filePath), 'error');
      if (!fs.existsSync(errorDir)) fs.mkdirSync(errorDir, { recursive: true });
      fs.renameSync(filePath, path.join(errorDir, fileName));

      throw error; // Bull gestisce il retry automatico
    }
  }
}
