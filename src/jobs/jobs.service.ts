// jobs/jobs.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import type { Queue } from 'bull';

@Injectable()
export class JobsService {
  private readonly logger = new Logger(JobsService.name);

  constructor(
    @InjectQueue('customer-jobs') private readonly customerJobsQueue: Queue,
  ) {}

  /**
   * Lancia un job per un customer specifico
   * @param customerId ID del customer
   * @param filePath Percorso completo del file XML
   * @param fileName Nome del file XML
   * @param supplierFilePath Percorso file fornitori (JSON/CSV)
   */
  async addCustomerJob(
    customerId: string,
    filePath: string,
    fileName: string,
    supplierFilePath: string,
  ): Promise<void> {
    this.logger.log(`Creazione job per customer ${customerId}, file: ${fileName}`);

    await this.customerJobsQueue.add(
      {
        customerId,
        filePath,
        fileName,
        supplierFilePath,
      },
      {
        attempts: 3,         // Retry automatico fino a 3 volte
        backoff: 15000,       // 15 secondi tra i retry
        removeOnComplete: true,
        removeOnFail: false, // mantiene i log di errore
      },
    );
  }
}
