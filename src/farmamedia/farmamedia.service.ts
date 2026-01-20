import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Farmamedia, FarmamediaDocument } from './schemas/farmamedia.schema';
import * as soap from 'soap';
import * as xml2js from 'xml2js';
import { HttpService } from '@nestjs/axios';
import { AxiosResponse } from 'axios';
import { lastValueFrom } from 'rxjs';
import { CompanyInfo } from 'src/interface/company-info';

@Injectable()
export class FarmamediaService {
  private readonly logger = new Logger(FarmamediaService.name);

  constructor(
    @InjectModel(Farmamedia.name) private readonly farmamediaModel: Model<FarmamediaDocument>,
    private readonly httpService: HttpService
  ) {}

  private wsdlUrl = 'http://webservices.farmadati.it/ws2/farmadatiitaliawebservicesm1.svc?singleWSDL';
  private uri = 'http://webservices.farmadati.it/ws2/download.aspx';
  private username = 'BDF2509911';
  private password = 'qnL9xdHs';
  private descriptionCache: Map<string, string> = new Map();
  private productCache: Map<string, any> = new Map();
  private companyCache = new Map<string, CompanyInfo>();

  async getByAIC(aic: string): Promise<any> {
    // 1️⃣ Controlla DB
    let entry = await this.farmamediaModel.findOne({ aic });
    if (entry) return entry;

    let name = await this.getName(aic);

    // 4️⃣ Recupera descrizione breve
    let shortDescription = await this.getDescription(aic);

    let data = await this.getProductData(aic);

    console.log(data);

    let images = await this.getImages(aic);

    // 6️⃣ Salva in DB
    const saved = await this.farmamediaModel.create({
      aic: aic,
      name,
      shortDescription,
      images,
      updatedAt: new Date(),
      data
    });

    return saved;
  }

  async getEnabledDataSets() {
    const client = await soap.createClientAsync(this.wsdlUrl);
    const schema = await client.GetSchemaDataSetAsync({ Username: this.username, Password: this.password, CodiceSetDati: 'TE005' });
    console.log(schema[0]);

    return schema;
  }

  private async xmlToJson(xml: string) {
    const parser = new xml2js.Parser({
      explicitArray: false, // niente array inutili
      trim: true
    });

    return await parser.parseStringPromise(xml);
  }

  private async getImages(aic: string): Promise<string[]> {
    const tabelleImmagini: Record<string, { key: string; field: string }> = {
      TE004: { key: 'FDI_T456', field: 'FDI_T459' },
      TE009: { key: 'FDI_0840', field: 'FDI_0843' },
    };

    const images: string[] = [];
    const client = await soap.createClientAsync(this.wsdlUrl);

    for (const [codiceSetDati, cfg] of Object.entries(tabelleImmagini)) {
      const [response] = await client.ExecuteQueryAsync({
        Username: this.username,
        Password: this.password,
        CodiceSetDati: codiceSetDati,
        CampiDaEstrarre: { string: [cfg.field] },
        Filtri: { Filter: [{ Key: cfg.key, Operator: '=', Value: aic, OrGroup: 0 }] },
        PageN: 1,
        PagingN: 1,
      });

      if (response.ExecuteQueryResult?.DescEsito === 'OK' && response.ExecuteQueryResult.OutputValue) {
        const parsed = await this.xmlToJson(response.ExecuteQueryResult.OutputValue);
        const product = parsed.TableResult?.Product;

        console.log(product);

        if (!product) continue;

        const imageNames = Array.isArray(product) ? product.map(p => p[cfg.field]) : [product[cfg.field]];

        for (const name of imageNames) 
        {
          const url = `${this.uri}?accesskey=${this.password}&tipodoc=${codiceSetDati}&nomefile=${name}`;
          try 
          {
            const { data } = await lastValueFrom(this.httpService.get(url, { responseType: 'arraybuffer' }));
            images.push(Buffer.from(data).toString('base64'));
          } 
          catch (err) 
          {
            this.logger.warn(`Errore download immagine ${name}: ${err.message}`);
          }
        }
      }
    }

    return images;
  }

  private async getDescription(aic: string): Promise<string> {
    if (this.descriptionCache.has(aic)) {
      return this.descriptionCache.get(aic) ?? '';
    }

    let description = '';

    // Mappa dataset => chiave filtro
    const datasets: Record<string, string> = {
      TE008: 'FDI_0001', // scheda descrittiva
      TE005: 'FDI_4887', // descrizione breve medicinali SOP-OTC
      TE006: 'FDI_0001', // omeopatici
      TE012: 'FDI_0001', // medicinali veterinari
      TR039: 'FDI_0001', // descrizione estesa
      TE018: 'FDI_0001', // sostituisce TE003
    };

    for (const [dataset, key] of Object.entries(datasets)) {
      try {
        const result = await this.queryDataset(aic, dataset, key);
        if (result) {
          // concatena tutti i campi come paragrafi
          for (const [field, text] of Object.entries(result)) {
            if (text) description += `<p>${text}</p>`;
          }
        }
      } catch (err) {
        this.logger.warn(`Errore dataset ${dataset} per AIC ${aic}: ${err.message}`);
      }
    }

    const product = await this.getProductData(aic);
    //const company = await this.getCompanyDetails(product.FDI_0040);

    if (description) {
      this.descriptionCache.set(aic, description);
    }

    return description;
  }

  private async getName(aic: string): Promise<string> {
    const campo = 'FDI_0004';
    const tabelle: Record<string, string> = {
      TE001: 'FDI_0001', // parafarmaci, dispositivi medici
      TE002: 'FDI_0001', // medicinali SOP-OTC
      TE006: 'FDI_0001', // omeopatici
      TE011: 'FDI_0001', // medicinali veterinari
    };

    const client = await soap.createClientAsync(this.wsdlUrl);

    for (const [dataset, key] of Object.entries(tabelle)) {
      try {
        const params = {
          Username: this.username,
          Password: this.password,
          CodiceSetDati: dataset,
          CampiDaEstrarre: { string: [campo] },
          Filtri: { Filter: [{ Key: key, Operator: '=', Value: aic, OrGroup: 0 }] },
          Ordinamento: null,
          Distinct: false,
          Count: false,
          PageN: 1,
          PagingN: 1,
        };

        const [response] = await client.ExecuteQueryAsync(params);
        const result = response?.ExecuteQueryResult;

        if (result?.CodEsito === 'OK' && result.OutputValue && result.OutputValue !== 'EMPTY') {
          const parsed = await xml2js.parseStringPromise(result.OutputValue, { explicitArray: false });
          const product = parsed?.TableResult?.Product;
          if (product && product[campo]) {
            return product[campo];
          }
        }
      } catch (err) {
        this.logger.warn(`Errore recupero nome da dataset ${dataset} per AIC ${aic}: ${err.message}`);
      }
    }

    return '';
  }

  private async getProductData(aic: string): Promise<any> {
    if (this.productCache.has(aic)) {
      return this.productCache.get(aic);
    }

    const tabelleDescrittive: Record<string, string> = {
      TE001: 'FDI_0001', // parafarmaci, dispositivi medici
      TE002: 'FDI_0001', // omeopatici
    };

    const client = await soap.createClientAsync(this.wsdlUrl);

    for (const [dataset, key] of Object.entries(tabelleDescrittive)) {
      try {
        const params = {
          Username: this.username,
          Password: this.password,
          CodiceSetDati: dataset,
          CampiDaEstrarre: { string: [key] },
          Filtri: { Filter: [{ Key: key, Operator: '=', Value: aic, OrGroup: 0 }] },
          Ordinamento: null,
          Distinct: false,
          Count: false,
          PageN: 1,
          PagingN: 1,
        };

        const [response] = await client.ExecuteQueryAsync(params);
        const result = response?.ExecuteQueryResult;

        if (result?.DescEsito === 'OK' && result.OutputValue) {
          const parsed = await xml2js.parseStringPromise(result.OutputValue, { explicitArray: false });
          const product = parsed?.TableResult?.Product;

          if (product) {
            this.productCache.set(aic, product);
            return product;
          }
        }
      } catch (err) {
        this.logger.warn(`Errore recupero dati prodotto da dataset ${dataset} per AIC ${aic}: ${err.message}`);
      }
    }

    // Se non trovato, ritorna oggetto vuoto
    return {};
  }

  private async queryDataset(aic: string, dataset: string, key: string): Promise<Record<string, string> | null> {
    const client = await soap.createClientAsync(this.wsdlUrl);

    const params = {
      Username: this.username,
      Password: this.password,
      CodiceSetDati: dataset,
      CampiDaEstrarre: { string: ['*'] }, // oppure specifici campi se li conosci
      Filtri: { Filter: [{ Key: key, Operator: '=', Value: aic, OrGroup: 0 }] },
      Ordinamento: null,
      Distinct: false,
      Count: false,
      PageN: 1,
      PagingN: 1,
    };

    const [response] = await client.ExecuteQueryAsync(params);
    const result = response?.ExecuteQueryResult;

    if (!result || result.CodEsito !== 'OK' || !result.OutputValue) return null;

    const parsed = await xml2js.parseStringPromise(result.OutputValue, { explicitArray: false, mergeAttrs: true });
    const product = parsed?.TableResult?.Product;
    if (!product) return null;

    return Array.isArray(product) ? product[0] : product;
  }

  private async getCompanyDetails(companyNumber: string): Promise<CompanyInfo | null> {
    try {
      // ✅ Controlla cache
      if (this.companyCache.has(companyNumber)) {
        return this.companyCache.get(companyNumber) ?? null;
      }

      // ⚡ Costruzione chiamata SOAP
      const soapBody = {
        Username: this.username,
        Password: this.password,
        CodiceSetDati: 'TS067',
        CampiDaEstrarre: { string: ['FDI_T008', 'FDI_T009', 'FDI_T010'] }, // aggiungi campi necessari
        Filtri: {
          Filter: [
            {
              Key: 'FDI_T008',
              Operator: '=',
              Value: companyNumber,
              OrGroup: 0,
            },
          ],
        },
        PageN: 1,
        PagingN: 1,
      };

      // 📡 Esegue la query SOAP
      const client = await soap.createClientAsync(this.wsdlUrl);
      const [response] = await client.ExecuteQueryAsync(soapBody);

      if (response.ExecuteQueryResult?.DescEsito !== 'OK') {
        this.logger.warn(`Errore dataset TS067 per azienda ${companyNumber}: ${response.ExecuteQueryResult?.DescEsito}`);
        return null;
      }

      // 🔄 Parsing XML in oggetto JS
      const parser = new xml2js.Parser({ explicitArray: false });
      const parsed = await parser.parseStringPromise(response.ExecuteQueryResult.OutputValue);
      const product = parsed?.NewDataSet?.Product || parsed?.TableResult?.Product;

      if (!product) return null;

      // Trasforma in oggetto CompanyInfo
      const companyInfo: CompanyInfo = {
        name: product.FDI_T009 || '',
        address: product.FDI_T010 || '',
        email: product.FDI_T011 || '',
        website: product.FDI_T012 || '',
      };

      // ✅ Salva in cache
      this.companyCache.set(companyNumber, companyInfo);

      return companyInfo;
    } catch (err) {
      this.logger.error(`Errore recupero informazioni ditta '${companyNumber}': ${err.message}`);
      return null;
    }
  }
}
