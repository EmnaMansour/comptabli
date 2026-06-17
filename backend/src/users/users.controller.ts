import {
  Delete,
  Controller,
  Body,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { Role, Status } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';

interface RequestWithUser extends Request {
  user: {
    userId: string;
    email: string;
    role: Role;
  };
}

@Controller('users')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('collaborators')
  @Roles(Role.COMPTABLE)
  createCollaborator(
    @Body() createUserDto: CreateUserDto,
    @Request() req: RequestWithUser,
  ) {
    return this.usersService.create(
      createUserDto,
      Role.COLLABORATEUR,
      Status.ACTIVE,
      req.user.userId,
      { sendCredentials: true },
    );
  }

  @Post('clients')
  @Roles(Role.COMPTABLE)
  createClient(@Body() createUserDto: CreateUserDto, @Request() req: RequestWithUser) {
    return this.usersService.create(
      createUserDto,
      Role.CLIENT,
      Status.ACTIVE,
      req.user.userId,
      { sendCredentials: true },
    );
  }

  @Get('me')
  getProfile(@Request() req: RequestWithUser) {
    return this.usersService.findById(req.user.userId);
  }

  @Get('messaging-directory')
  getMessagingDirectory(@Request() req: RequestWithUser) {
    return this.usersService.messagingDirectory(req.user.userId, req.user.role);
  }

  @Get('collaborators/stats')
  @Roles(Role.COMPTABLE)
  getCollaboratorsWithStats(@Request() req: RequestWithUser) {
    return this.usersService.getCollaboratorsWithStats(req.user.userId);
  }

  @Get('clients/stats')
  @Roles(Role.COMPTABLE)
  getClientsWithStats(@Request() req: RequestWithUser) {
    return this.usersService.getClientsWithStats(req.user.userId);
  }

  @Get(':id')
  getUserById(@Param('id') id: string) {
    return this.usersService.findById(id);
  }

  @Patch('clients/:id')
  @Roles(Role.COMPTABLE)
  updateClient(@Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data);
  }

  @Delete('clients/:id')
  @Roles(Role.COMPTABLE)
  deleteClient(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.usersService.removeSafe(id, req.user.userId);
  }

  @Patch('collaborators/:id')
  @Roles(Role.COMPTABLE)
  updateCollaborator(@Param('id') id: string, @Body() data: any) {
    return this.usersService.update(id, data);
  }

  @Delete('collaborators/:id')
  @Roles(Role.COMPTABLE)
  deleteCollaborator(@Param('id') id: string, @Request() req: RequestWithUser) {
    return this.usersService.removeSafe(id, req.user.userId);
  }

  @Patch('me/password')
  async changePassword(
    @Request() req: RequestWithUser,
    @Body() body: { password?: string },
  ) {
    if (!body.password) {
      throw new BadRequestException('Mot de passe manquant');
    }
    return this.usersService.changePassword(req.user.userId, body.password);
  }
}
