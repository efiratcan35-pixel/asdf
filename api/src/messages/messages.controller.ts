import { Body, Controller, Delete, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MessagesService } from './messages.service';

@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagesController {
  constructor(private messagesService: MessagesService) {}

  @Get('mine')
  mine(@Req() req: any) {
    return this.messagesService.mine(req.user.sub);
  }

  @Get('unread-count')
  unreadCount(@Req() req: any) {
    return this.messagesService.unreadCount(req.user.sub);
  }

  @Get('project/:projectId/user/:otherUserId')
  forProject(@Req() req: any, @Param('projectId') projectId: string, @Param('otherUserId') otherUserId: string) {
    return this.messagesService.forProject(req.user.sub, Number(projectId), Number(otherUserId));
  }

  @Get('user/:otherUserId')
  direct(@Req() req: any, @Param('otherUserId') otherUserId: string) {
    return this.messagesService.direct(req.user.sub, Number(otherUserId));
  }

  @Get('user-meta/:otherUserId')
  userMeta(@Param('otherUserId') otherUserId: string) {
    return this.messagesService.userMeta(Number(otherUserId));
  }

  @Post()
  send(@Req() req: any, @Body() body: any) {
    return this.messagesService.send(req.user.sub, body);
  }

  @Post('mark-read-all')
  markReadAll(@Req() req: any) {
    return this.messagesService.markReadAll(req.user.sub);
  }

  @Post('mark-read-conversation')
  markReadConversation(@Req() req: any, @Body() body: any) {
    return this.messagesService.markReadConversation(req.user.sub, body);
  }

  @Delete('conversation')
  deleteConversation(@Req() req: any, @Body() body: any) {
    return this.messagesService.deleteConversation(req.user.sub, body);
  }

  @Patch(':messageId')
  updateMessage(@Req() req: any, @Param('messageId') messageId: string, @Body() body: any) {
    return this.messagesService.updateMessage(req.user.sub, Number(messageId), body);
  }

  @Delete(':messageId')
  deleteMessage(@Req() req: any, @Param('messageId') messageId: string) {
    return this.messagesService.deleteMessage(req.user.sub, Number(messageId));
  }
}
