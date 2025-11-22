import {
    Controller,
    Post,
    UseInterceptors,
    UploadedFiles,
    BadRequestException,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Controller('uploads')
export class UploadsController {
    @Post()
    @UseInterceptors(
        FilesInterceptor('files', 10, {
            storage: diskStorage({
                destination: './uploads',
                filename: (req, file, callback) => {
                    const uniqueSuffix = uuidv4();
                    const ext = extname(file.originalname);
                    callback(null, `${uniqueSuffix}${ext}`);
                },
            }),
            fileFilter: (req, file, callback) => {
                if (!file.mimetype.match(/\/(jpg|jpeg|png|gif)$/)) {
                    return callback(
                        new BadRequestException('Only image files are allowed!'),
                        false,
                    );
                }
                callback(null, true);
            },
            limits: {
                fileSize: 5 * 1024 * 1024, // 5MB
            },
        }),
    )
    uploadFiles(@UploadedFiles() files: Array<Express.Multer.File>) {
        const urls = files.map((file) => {
            // Assuming the server is running on localhost:5050
            // In production, this should use an environment variable
            return `http://localhost:5050/uploads/${file.filename}`;
        });
        return { urls };
    }
}
