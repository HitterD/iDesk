import { Controller, Request, Post, UseGuards, Body, HttpCode } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import { RegisterDto } from './dto/register.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LocalAuthGuard } from '../infrastructure/guards/local-auth.guard';
import { JwtAuthGuard } from '../infrastructure/guards/jwt-auth.guard';
import { ApiOperation, ApiResponse, ApiTags, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @ApiOperation({ summary: 'User login' })
    async login(@Request() req) {
        return this.authService.login(req.user);
    }

    @Post('register')
    @ApiOperation({ summary: 'User registration' })
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }

    @Post('change-password')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(200)
    @ApiOperation({ summary: 'Change password' })
    @ApiResponse({ status: 200, description: 'Password changed successfully' })
    @ApiResponse({ status: 400, description: 'Invalid current password' })
    async changePassword(@Request() req, @Body() changePasswordDto: ChangePasswordDto) {
        return this.authService.changePassword(req.user.userId, changePasswordDto);
    }
}
