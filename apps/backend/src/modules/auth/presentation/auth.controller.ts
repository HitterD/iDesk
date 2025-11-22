import { Controller, Request, Post, UseGuards, Body } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from '../application/auth.service';
import { RegisterDto } from './dto/register.dto';
import { LocalAuthGuard } from '../infrastructure/guards/local-auth.guard';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @UseGuards(LocalAuthGuard)
    @Post('login')
    @Throttle({ default: { limit: 5, ttl: 60000 } })
    async login(@Request() req) {
        return this.authService.login(req.user);
    }

    @Post('register')
    async register(@Body() registerDto: RegisterDto) {
        return this.authService.register(registerDto);
    }
}
