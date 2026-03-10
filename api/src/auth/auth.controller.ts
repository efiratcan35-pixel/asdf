import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Query,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { existsSync, mkdirSync } from 'fs';
import { extname, join } from 'path';

const uploadsDir = join(process.cwd(), 'uploads');
if (!existsSync(uploadsDir)) mkdirSync(uploadsDir, { recursive: true });

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  register(@Body() body: any) {
    return this.authService.register(body);
  }

  @Post('login')
  login(@Body() body: any) {
    const identifier = String(body?.identifier ?? body?.email ?? body?.phone ?? '');
    const method = body?.method === 'phone' ? 'phone' : 'email';
    return this.authService.login(identifier, body.password, method);
  }

  @Post('verify-email')
  verifyEmail(@Body() body: { token?: string }) {
    return this.authService.verifyEmail(String(body?.token ?? ''));
  }

  @Post('resend-verification')
  resendVerification(@Body() body: { email?: string }) {
    return this.authService.resendVerificationEmail(String(body?.email ?? ''));
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  me(@Req() req: any) {
    return req.user;
  }

  @UseGuards(JwtAuthGuard)
  @Get('contractor-profile')
  contractorProfile(@Req() req: any) {
    return this.authService.getContractorProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('contractor-profile')
  updateContractorProfile(@Req() req: any, @Body() body: any) {
    return this.authService.updateContractorProfile(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('contractor-media')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: uploadsDir,
        filename: (_, file, cb) => {
          const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
          cb(null, `${unique}${extname(file.originalname)}`);
        },
      }),
      limits: { fileSize: 30 * 1024 * 1024 },
    }),
  )
  async uploadContractorMedia(
    @Req() req: any,
    @UploadedFile() file: any,
    @Body('type') type: 'photo' | 'video',
    @Body('caption') caption?: string,
  ) {
    if (!file) throw new BadRequestException('Dosya gerekli');
    if (type !== 'photo' && type !== 'video') throw new BadRequestException('type photo veya video olmali');

    const url = `/uploads/${file.filename}`;
    return this.authService.createContractorMedia(req.user.sub, { url, type, caption });
  }

  @UseGuards(JwtAuthGuard)
  @Delete('contractor-media/:id')
  deleteContractorMedia(@Req() req: any, @Param('id') id: string) {
    return this.authService.deleteContractorMedia(req.user.sub, Number(id));
  }

  @UseGuards(JwtAuthGuard)
  @Get('market-contractors')
  marketContractors(@Req() req: any) {
    return this.authService.listMarketContractors(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('market-investors')
  marketInvestors(@Req() req: any) {
    return this.authService.listMarketInvestors(req.user.sub);
  }

  @Get('public-market-contractors-preview')
  marketContractorsPreview(@Query('limit') limit?: string) {
    return this.authService.listPublicMarketContractorsPreview(Number(limit ?? 3));
  }

  @Get('public-market-contractors/:userId')
  publicMarketContractorDetail(@Param('userId') userId: string) {
    return this.authService.getPublicMarketContractorDetail(Number(userId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('market-contractors/:userId')
  marketContractorDetail(@Req() req: any, @Param('userId') userId: string) {
    return this.authService.getMarketContractorDetail(req.user.sub, Number(userId));
  }

  @UseGuards(JwtAuthGuard)
  @Get('market-investors/:userId')
  marketInvestorDetail(@Req() req: any, @Param('userId') userId: string) {
    return this.authService.getMarketInvestorDetail(req.user.sub, Number(userId));
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/password')
  updatePassword(@Req() req: any, @Body() body: any) {
    return this.authService.updatePassword(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('account/hidden')
  accountHidden(@Req() req: any) {
    return this.authService.getAccountHidden(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/hide')
  setAccountHidden(@Req() req: any, @Body() body: { hidden?: boolean }) {
    return this.authService.setAccountHidden(req.user.sub, Boolean(body.hidden));
  }

  @UseGuards(JwtAuthGuard)
  @Delete('account')
  deleteAccount(@Req() req: any) {
    return this.authService.deleteAccount(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Get('account/profile')
  accountProfile(@Req() req: any) {
    return this.authService.getAccountProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('account/email')
  updateEmail(@Req() req: any, @Body() body: { email?: string }) {
    return this.authService.updateEmail(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Put('account/phone')
  updatePhone(@Req() req: any, @Body() body: { phone?: string }) {
    return this.authService.updatePhone(req.user.sub, body);
  }

  @UseGuards(JwtAuthGuard)
  @Get('investor-profile')
  investorProfile(@Req() req: any) {
    return this.authService.getInvestorProfile(req.user.sub);
  }

  @UseGuards(JwtAuthGuard)
  @Put('investor-profile')
  updateInvestorProfile(@Req() req: any, @Body() body: any) {
    return this.authService.updateInvestorProfile(req.user.sub, body);
  }
}
