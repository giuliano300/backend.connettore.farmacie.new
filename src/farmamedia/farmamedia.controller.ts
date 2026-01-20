import { Controller, Get, Param, Logger, Post } from '@nestjs/common';
import { FarmamediaService } from './farmamedia.service';
import { Farmamedia } from './schemas/farmamedia.schema';
import { tmpdir } from 'os';

@Controller('farmamedia')
export class FarmamediaController {
  private readonly logger = new Logger(FarmamediaController.name);

  constructor(private readonly farmamediaService: FarmamediaService) {}

  /**
   * Endpoint di test:
   * GET /farmamedia/:aic
   */
  @Get(':aic')
  async getByAic(@Param('aic') aic: string): Promise<Farmamedia | { message: string }> {
    try {
      const product = await this.farmamediaService.getByAIC(aic);

      if (!product) {
        return { message: `Prodotto con AIC ${aic} non trovato` };
      }

      return product;
    } 
    catch (err) 
    {
      this.logger.error(`Errore recupero prodotto aic ${aic}: ${err.message}`);
      return { message: 'Errore interno del server' };
    }
  }

}
