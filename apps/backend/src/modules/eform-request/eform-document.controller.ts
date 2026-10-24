import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Request, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../shared/core/guards/roles.guard';
import { Roles } from '../../shared/core/decorators/roles.decorator';
import { SiteActor } from '../../shared/core/utils/site-scope.util';
import { createFileFilter, createStorage, FILE_SIZE_LIMITS } from '../../shared/core/config/upload.config';
import { ICT_ROLES } from './eform-roles.constants';
import { EFormDocumentService, GM_APPROVAL_UPLOAD_DIR } from './eform-document.service';
import { UpdateDocumentNumberDto } from './dto/update-document-number.dto';

const GM_APPROVAL_UPLOAD = {
  storage: createStorage(`./uploads/${GM_APPROVAL_UPLOAD_DIR}`),
  fileFilter: createFileFilter('CONTRACT'),
  limits: { fileSize: FILE_SIZE_LIMITS.DOCUMENT },
};

const actorOf = (req: any): SiteActor => ({ role: req.user.role, siteId: req.user.siteId ?? null });

@ApiTags('E-Form Requests')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('eform-request')
export class EFormDocumentController {
  constructor(private readonly documents: EFormDocumentService) {}

  @Patch(':id/document-number')
  @Roles(...ICT_ROLES)
  @ApiOperation({ summary: 'ICT corrects the document number' })
  updateDocumentNumber(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateDocumentNumberDto) {
    return this.documents.updateDocumentNumber(actorOf(req), id, req.user.userId, dto.documentNumber);
  }

  @Post(':id/gm-approval')
  @Roles(...ICT_ROLES)
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'ICT uploads the form signed by the GM (PDF)' })
  @UseInterceptors(FileInterceptor('file', GM_APPROVAL_UPLOAD))
  // No ParseUUIDPipe here: pipes run after multer has stored the file, so a refusal there would orphan it.
  // The service checks the id and removes the file whenever it refuses.
  uploadGmApproval(@Request() req: any, @Param('id') id: string, @UploadedFile() file: Express.Multer.File) {
    return this.documents.uploadGmApproval(actorOf(req), id, req.user.userId, file);
  }

  @Get(':id/gm-approval')
  @ApiOperation({ summary: 'Download the GM-signed form' })
  async downloadGmApproval(@Request() req: any, @Param('id', ParseUUIDPipe) id: string, @Res() res: Response) {
    const { path, fileName } = await this.documents.getGmApproval(actorOf(req), id, req.user.userId);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-cache');
    res.download(path, fileName, (err) => {
      if (err && !res.headersSent) res.status(404).json({ statusCode: 404, message: 'Berkas tanda tangan GM tidak ditemukan' });
    });
  }
}
