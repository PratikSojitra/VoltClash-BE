import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { AxiosError } from 'axios';

@Injectable()
export class ClashApiService {
  private readonly logger = new Logger(ClashApiService.name);
  private readonly baseUrl = 'https://api.clashofclans.com/v1';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  async getPlayerData(tag: string): Promise<any> {
    // Format the tag properly (standardize on # and URI-encode for the API path)
    let formattedTag = tag.toUpperCase().trim();
    if (!formattedTag.startsWith('#')) {
      formattedTag = `#${formattedTag}`;
    }

    const apiKey = this.configService.get<string>('CLASH_API_KEY');
    if (!apiKey) {
      this.logger.error('CLASH_API_KEY environment variable is not defined');
      throw new HttpException(
        'Clash API configuration error on backend',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }

    const encodedTag = encodeURIComponent(formattedTag);
    const url = `${this.baseUrl}/players/${encodedTag}`;

    try {
      const response = await firstValueFrom(
        this.httpService.get(url, {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        }),
      );
      return response.data;
    } catch (err) {
      const axiosError = err as AxiosError;
      if (axiosError.response) {
        const status = axiosError.response.status;
        this.logger.warn(`Clash API returned status ${status} for tag ${formattedTag}`);
        
        if (status === HttpStatus.NOT_FOUND) {
          throw new HttpException(
            `Player with tag ${formattedTag} not found on Clash of Clans servers`,
            HttpStatus.NOT_FOUND,
          );
        }
        if (status === HttpStatus.TOO_MANY_REQUESTS) {
          throw new HttpException(
            'Rate limit exceeded. Please try again later',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        if (status === HttpStatus.FORBIDDEN || status === HttpStatus.UNAUTHORIZED) {
          throw new HttpException(
            'Access denied. Clash of Clans API token is invalid or IP not whitelisted',
            HttpStatus.FORBIDDEN,
          );
        }
        throw new HttpException(
          `Clash API failed: ${axiosError.response.statusText}`,
          status,
        );
      }
      this.logger.error(`Clash API Request Error: ${axiosError.message}`);
      throw new HttpException(
        'Failed to connect to Clash of Clans server',
        HttpStatus.BAD_GATEWAY,
      );
    }
  }
}
