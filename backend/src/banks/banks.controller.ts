import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  Request,
} from '@nestjs/common';
import { BanksService } from './banks.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role } from '@prisma/client';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('banks')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class BanksController {
  constructor(private readonly banksService: BanksService) {}

  @Post()
  @Roles(Role.CLIENT)
  create(@Body() body: any, @Request() req: RequestWithUser) {
    return this.banksService.create(body, req.user.userId);
  }

  @Get()
  @Roles(Role.CLIENT)
  findAll(@Request() req: RequestWithUser) {
    return this.banksService.findAll(req.user.userId);
  }

  @Get(':id')
  @Roles(Role.CLIENT)
  findOne(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.banksService.findOne(id, req.user.userId);
  }

  @Put(':id')
  @Roles(Role.CLIENT)
  update(@Param('id') id: string, @Body() body: any, @Request() req: RequestWithUser) {
    return this.banksService.update(id, body, req.user.userId);
  }

  @Delete(':id')
  @Roles(Role.CLIENT)
  remove(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.banksService.remove(id, req.user.userId);
  }

  @Post(':id/transactions')
  @Roles(Role.CLIENT)
  addTransaction(
    @Param('id') id: string,
    @Body() body: any,
    @Request() req: RequestWithUser,
  ) {
    return this.banksService.addTransaction(id, body, req.user.userId);
  }
}
