import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { MessagingService } from './messaging.service';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../common/guards/roles.guard';

@Controller('messaging')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post('conversations')
  createConversation(@Body() body: { userIds?: string[]; type?: string; name?: string }, @Request() req: any) {
    const other = Array.isArray(body.userIds) ? body.userIds : [];
    const userIds = [...new Set([req.user.userId, ...other])];
    return this.messagingService.createConversation(userIds, body.type ?? 'PRIVATE', body.name);
  }

  @Get('conversations')
  findAllConversations(@Request() req: any) {
    return this.messagingService.findAllConversations(req.user.userId);
  }

  @Get('conversations/:id')
  findConversation(@Param('id') id: string, @Request() req: any) {
    return this.messagingService.findConversation(id, req.user.userId);
  }

  @Post('conversations/:id/messages')
  sendMessage(
    @Param('id') id: string,
    @Body() body: { content: string; type?: string; linkedId?: string; linkedType?: 'Document' | 'Request' },
    @Request() req: any,
  ) {
    return this.messagingService.sendMessage(
      id, 
      req.user.userId, 
      body.content, 
      body.type ?? 'TEXT',
      body.linkedId,
      body.linkedType
    );
  }

  @Post('messages/:id/read')
  markAsRead(@Param('id') id: string, @Request() req: any) {
    return this.messagingService.markAsRead(id, req.user.userId);
  }

  @Patch('messages/:id')
  updateMessage(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    return this.messagingService.updateMessage(id, req.user.userId, body.content);
  }

  @Delete('messages/:id')
  deleteMessage(@Param('id') id: string, @Request() req: any) {
    return this.messagingService.deleteMessage(id, req.user.userId);
  }
}
