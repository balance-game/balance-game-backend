import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { ConfigService } from '@nestjs/config';
import { v4 as uuid } from 'uuid';
import { extname } from 'path';

@Injectable()
export class R2Service {
  private s3: S3Client;
  private bucket: string;

  // R2 기본 세팅
  constructor(private readonly configService: ConfigService) {
    try {
        this.s3 = new S3Client({
            region: this.configService.get<string>('R2_REGION', 'auto'),
            endpoint: this.configService.get<string>('R2_ENDPOINT', ''),
            credentials: {
                accessKeyId: this.configService.get<string>('R2_ACCESS_KEY_ID', ''),
                secretAccessKey: this.configService.get<string>('R2_SECRET_ACCESS_KEY', ''),
            },
        });
    } catch(err) {
        console.error(err);
        throw new Error("R2 관련 환경변수가 누락되었습니다.");
    }

    this.bucket = this.configService.get<string>('R2_BUCKET', '');
  }
  
  // 이미지 업로드
  async uploadImage(file: Express.Multer.File, folder: string) {
    if (!file) {
        throw new Error("파일이 비었습니다");
    }
    else {
        const key = `${folder}/${uuid()}${extname(file.originalname)}`;
        let res;

        try {
            res = await this.s3.send(
                new PutObjectCommand({
                    Bucket: this.bucket,
                    Key: key,
                    Body: file.buffer,
                    ContentType: file.mimetype,
                    CacheControl: 'public, max-age=31536000',
                }),
            );
        } catch(err) {
            console.error(err);
            throw new InternalServerErrorException("저장에 실패했습니다");
        }

        return `${uuid()}${extname(file.originalname)}`;
    }
  }
}
