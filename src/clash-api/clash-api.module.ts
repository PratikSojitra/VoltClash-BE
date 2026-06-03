import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ClashApiService } from './clash-api.service';

@Module({
  imports: [HttpModule],
  providers: [ClashApiService],
  exports: [ClashApiService],
})
export class ClashApiModule {}
