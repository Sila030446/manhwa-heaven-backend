import { Module } from '@nestjs/common';
import { AwsService } from './aws.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  providers: [AwsService],
  exports: [AwsService], // ทำให้ AwsService ใช้งานได้ในโมดูลอื่น
})
export class AwsModule {}
