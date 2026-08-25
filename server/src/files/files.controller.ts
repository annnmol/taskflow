import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  NotFoundException,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { CreateFileDto } from './dto/create-file.dto';
import { FilesService } from './files.service';
import { ListRowsQueryDto } from './dto/list-rows-query.dto';

@Controller('files')
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Get()
  async listFiles() {
    return this.filesService.listFiles();
  }

  @Post()
  async createFile(
    @Body()
    body: CreateFileDto,
  ) {
    return this.filesService.createFile({
      name: body.name,
      contentType: body.contentType,
      size: body.size,
    });
  }

  @Get(':fileId/download')
  async downloadFile(@Param('fileId', new ParseUUIDPipe()) fileId: string) {
    const result = await this.filesService.createDownloadUrl(fileId);

    if (!result.ok) {
      if (result.code === 'FILE_NOT_FOUND') {
        throw new NotFoundException({
          code: result.code,
          message: result.message,
        });
      }

      throw new NotFoundException({
        code: result.code,
        message: result.message,
      });
    }

    return result.body;
  }

  @Post(':fileId/queue')
  async queueFile(@Param('fileId', new ParseUUIDPipe()) fileId: string) {
    return this.filesService.queueFileForProcessing(fileId);
  }

  @Get(':fileId/rows')
  async listRows(
    @Param('fileId', new ParseUUIDPipe()) fileId: string,
    @Query() query: ListRowsQueryDto,
  ) {
    return this.filesService.listRows(fileId, query.page, query.pageSize);
  }

  @Get(':fileId')
  async getFile(@Param('fileId', new ParseUUIDPipe()) fileId: string) {
    const file = await this.filesService.getFileDetails(fileId);

    if (!file) {
      throw new NotFoundException({
        code: 'FILE_NOT_FOUND',
        message: 'File not found.',
      });
    }

    return file;
  }
}
