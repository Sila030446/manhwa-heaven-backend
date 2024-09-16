import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';

@Injectable()
export class AwsService {
  private s3Client: S3Client;
  private bucketName: string;

  constructor(private readonly configService: ConfigService) {
    this.s3Client = new S3Client({
      region: this.configService.get<string>('AWS_REGION'),
      credentials: {
        accessKeyId: this.configService.get<string>('AWS_ACCESS_KEY_ID'),
        secretAccessKey: this.configService.get<string>(
          'AWS_SECRET_ACCESS_KEY',
        ),
      },
    });

    this.bucketName = this.configService.get<string>('AWS_S3_BUCKET_NAME');
  }

  async uploadImageFromUrl(
    imageUrl: string,
    mangaTitle: string,
    chapterTitle: string,
  ): Promise<string> {
    try {
      const response = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
      });
      const buffer = Buffer.from(response.data, 'binary');

      // Create a unique file name
      const fileName = `${uuidv4()}.jpg`;

      // Create a folder structure based on manga title and chapter title
      const key = `${mangaTitle}/${chapterTitle}/${fileName}`;

      const uploadCommand = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: key,
        Body: buffer,
        ContentType: response.headers['content-type'],
        ACL: 'public-read',
      });

      await this.s3Client.send(uploadCommand);

      const s3Url = `https://${this.bucketName}.s3.${this.configService.get<string>('AWS_REGION')}.amazonaws.com/${key}`;
      return s3Url;
    } catch (error) {
      console.error('Error uploading image to S3:', error);
      throw new InternalServerErrorException('Failed to upload image to S3');
    }
  }
}
