import { IsString, IsNotEmpty } from 'class-validator';

export class ScanOcrDto {
    @IsString()
    @IsNotEmpty()
    fileUrl: string;
}
