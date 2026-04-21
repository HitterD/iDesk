# Telegram Bot Integration - Implementation Plan

## 📋 Overview

Integrasi Telegram Bot dengan iDesk Helpdesk System untuk memungkinkan user membuat dan mengelola tiket support langsung dari Telegram.

### Goals
- User dapat membuat tiket baru via Telegram
- User menerima notifikasi real-time tentang update tiket
- Agent/Admin dapat menerima notifikasi tiket baru
- User dapat melihat status tiket dan membalas via Telegram
- Integrasi dengan Knowledge Base untuk self-service

---

## 🏗️ Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│                 │     │                  │     │                 │
│  Telegram User  │◄───►│  Telegram API    │◄───►│  iDesk Backend  │
│                 │     │                  │     │                 │
└─────────────────┘     └──────────────────┘     └────────┬────────┘
                                                          │
                                                          ▼
                                                 ┌─────────────────┐
                                                 │                 │
                                                 │    PostgreSQL   │
                                                 │                 │
                                                 └─────────────────┘
```

### Components
1. **Telegram Bot Module** - NestJS module untuk handle bot logic
2. **Webhook Handler** - Receive updates dari Telegram
3. **Message Parser** - Parse dan route pesan user
4. **Notification Service** - Kirim notifikasi ke Telegram
5. **Session Manager** - Manage conversation state

---

## 🎯 Features

### Phase 1: Core Features
| Feature | Priority | Description |
|---------|----------|-------------|
| Link Account | HIGH | Hubungkan akun Telegram dengan akun iDesk |
| Create Ticket | HIGH | Buat tiket baru via chat |
| View Tickets | HIGH | Lihat daftar tiket aktif |
| Reply to Ticket | HIGH | Balas tiket via Telegram |
| Receive Notifications | HIGH | Terima notifikasi update tiket |

### Phase 2: Advanced Features
| Feature | Priority | Description |
|---------|----------|-------------|
| Search KB | MEDIUM | Cari artikel Knowledge Base |
| Inline Buttons | MEDIUM | Interactive buttons untuk actions |
| File Attachments | MEDIUM | Kirim file/gambar ke tiket |
| Agent Dashboard | LOW | Agent terima & assign tiket via Telegram |
| Analytics | LOW | Bot usage statistics |

---

## 📁 File Structure

```
apps/backend/src/modules/telegram/
├── telegram.module.ts
├── telegram.service.ts
├── telegram.controller.ts
├── telegram.update.ts              # Bot update handlers
├── entities/
│   └── telegram-session.entity.ts
├── dto/
│   ├── link-account.dto.ts
│   └── create-ticket-bot.dto.ts
├── interfaces/
│   └── telegram-context.interface.ts
├── decorators/
│   └── telegram-user.decorator.ts
├── guards/
│   └── telegram-auth.guard.ts
└── constants/
    └── bot-commands.ts
```

---

## 🗃️ Database Changes

### New Table: `telegram_session`

```sql
CREATE TABLE telegram_session (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    telegram_username VARCHAR(255),
    telegram_first_name VARCHAR(255),
    user_id UUID REFERENCES "user"(id),
    chat_id BIGINT NOT NULL,
    state VARCHAR(50) DEFAULT 'IDLE',
    state_data JSONB,
    linked_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_telegram_session_telegram_id ON telegram_session(telegram_id);
CREATE INDEX idx_telegram_session_user_id ON telegram_session(user_id);
```

### Conversation States
```typescript
enum TelegramState {
    IDLE = 'IDLE',
    AWAITING_LINK_CODE = 'AWAITING_LINK_CODE',
    CREATING_TICKET_SUBJECT = 'CREATING_TICKET_SUBJECT',
    CREATING_TICKET_DESCRIPTION = 'CREATING_TICKET_DESCRIPTION',
    CREATING_TICKET_PRIORITY = 'CREATING_TICKET_PRIORITY',
    REPLYING_TO_TICKET = 'REPLYING_TO_TICKET',
    SEARCHING_KB = 'SEARCHING_KB',
}
```

### Update User Table
```sql
ALTER TABLE "user" ADD COLUMN telegram_id BIGINT UNIQUE;
ALTER TABLE "user" ADD COLUMN telegram_chat_id BIGINT;
ALTER TABLE "user" ADD COLUMN telegram_notifications BOOLEAN DEFAULT true;
```

---

## 🤖 Bot Commands

| Command | Description | Access |
|---------|-------------|--------|
| `/start` | Welcome message & menu | All |
| `/link` | Link Telegram dengan akun iDesk | All |
| `/unlink` | Unlink akun | Linked Users |
| `/newticket` | Buat tiket baru | Linked Users |
| `/mytickets` | Lihat tiket saya | Linked Users |
| `/ticket_<id>` | Lihat detail tiket | Linked Users |
| `/reply_<id>` | Balas tiket | Linked Users |
| `/search <query>` | Cari Knowledge Base | All |
| `/help` | Bantuan & daftar command | All |
| `/settings` | Pengaturan notifikasi | Linked Users |

---

## 🔌 API Endpoints

### Bot Webhook
```
POST /api/telegram/webhook
- Receive updates from Telegram
- Verify webhook secret
```

### Account Linking
```
POST /api/telegram/generate-link-code
- Generate 6-digit code untuk linking
- Code expires in 5 minutes

POST /api/telegram/verify-link
- Verify link code dari Telegram
```

### User Settings
```
GET /api/users/me/telegram
- Get Telegram integration status

PATCH /api/users/me/telegram
- Update Telegram notification settings

DELETE /api/users/me/telegram
- Unlink Telegram account
```

---

## 📝 Implementation Steps

### Step 1: Setup Bot & Module (Day 1)
```bash
npm install telegraf @types/telegraf
```

1. Create Telegram module structure
2. Configure bot token from environment
3. Setup webhook endpoint
4. Register bot commands with BotFather

### Step 2: Database & Entities (Day 1)
1. Create TelegramSession entity
2. Update User entity with Telegram fields
3. Run migrations
4. Create repository methods

### Step 3: Account Linking (Day 2)
1. Implement `/link` command flow
2. Generate secure link codes
3. Verify codes in web dashboard
4. Store Telegram ID in user record

### Step 4: Ticket Creation (Day 2-3)
1. Implement conversation flow for ticket creation
2. Parse subject, description, priority
3. Create ticket via existing TicketService
4. Send confirmation with ticket details

### Step 5: Ticket Management (Day 3)
1. List user's tickets with inline buttons
2. View ticket details
3. Reply to tickets
4. Handle file attachments

### Step 6: Notifications (Day 4)
1. Integrate with existing NotificationService
2. Send Telegram messages on ticket events:
   - Ticket created
   - New reply
   - Status changed
   - Assigned to agent
3. Respect user notification preferences

### Step 7: Knowledge Base (Day 4)
1. Implement `/search` command
2. Show article previews
3. Link to full articles

### Step 8: Testing & Polish (Day 5)
1. Test all conversation flows
2. Error handling
3. Rate limiting
4. Logging & monitoring

---

## 💻 Code Examples

### telegram.module.ts
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { TelegramController } from './telegram.controller';
import { TelegramUpdate } from './telegram.update';
import { TelegramSession } from './entities/telegram-session.entity';
import { UsersModule } from '../users/users.module';
import { TicketingModule } from '../ticketing/ticketing.module';

@Module({
    imports: [
        TypeOrmModule.forFeature([TelegramSession]),
        TelegrafModule.forRoot({
            token: process.env.TELEGRAM_BOT_TOKEN,
            launchOptions: {
                webhook: {
                    domain: process.env.BACKEND_URL,
                    path: '/api/telegram/webhook',
                },
            },
        }),
        UsersModule,
        TicketingModule,
    ],
    providers: [TelegramService, TelegramUpdate],
    controllers: [TelegramController],
    exports: [TelegramService],
})
export class TelegramModule {}
```

### telegram.update.ts (Bot Handlers)
```typescript
import { Update, Start, Help, Command, On, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TelegramService } from './telegram.service';

@Update()
export class TelegramUpdate {
    constructor(private readonly telegramService: TelegramService) {}

    @Start()
    async onStart(@Ctx() ctx: Context) {
        const keyboard = {
            inline_keyboard: [
                [{ text: '🔗 Link Account', callback_data: 'link' }],
                [{ text: '🎫 New Ticket', callback_data: 'new_ticket' }],
                [{ text: '📋 My Tickets', callback_data: 'my_tickets' }],
                [{ text: '🔍 Search KB', callback_data: 'search_kb' }],
            ],
        };

        await ctx.reply(
            `👋 Welcome to iDesk Support Bot!\n\n` +
            `I can help you:\n` +
            `• Create support tickets\n` +
            `• Track your ticket status\n` +
            `• Search our knowledge base\n\n` +
            `Use the buttons below or type /help for commands.`,
            { reply_markup: keyboard }
        );
    }

    @Command('newticket')
    async onNewTicket(@Ctx() ctx: Context) {
        const session = await this.telegramService.getSession(ctx.from.id);
        
        if (!session?.userId) {
            return ctx.reply(
                '❌ Please link your account first.\n' +
                'Use /link to connect your iDesk account.'
            );
        }

        await this.telegramService.setState(ctx.from.id, 'CREATING_TICKET_SUBJECT');
        await ctx.reply('📝 Please enter the ticket subject:');
    }

    @On('text')
    async onText(@Ctx() ctx: Context) {
        await this.telegramService.handleMessage(ctx);
    }

    @On('callback_query')
    async onCallback(@Ctx() ctx: Context) {
        await this.telegramService.handleCallback(ctx);
    }
}
```

### Notification Integration
```typescript
// In NotificationService - add Telegram notification
async sendTelegramNotification(userId: string, message: string) {
    const user = await this.userRepo.findOne({ where: { id: userId } });
    
    if (user?.telegramChatId && user?.telegramNotifications) {
        await this.telegramService.sendMessage(user.telegramChatId, message);
    }
}
```

---

## 🔐 Security Considerations

1. **Webhook Verification**
   - Validate Telegram webhook signature
   - Use secret token in webhook URL

2. **Account Linking**
   - Short-lived link codes (5 min expiry)
   - One-time use codes
   - Rate limiting on code generation

3. **Authorization**
   - Verify user ownership before ticket operations
   - Check linked status before sensitive operations

4. **Rate Limiting**
   - Limit messages per user per minute
   - Prevent spam ticket creation

---

## 🧪 Testing Plan

### Unit Tests
- [ ] TelegramService methods
- [ ] Session state management
- [ ] Link code generation/verification

### Integration Tests
- [ ] Webhook endpoint
- [ ] Account linking flow
- [ ] Ticket creation flow
- [ ] Notification delivery

### Manual Testing
- [ ] Test with real Telegram account
- [ ] Test all commands
- [ ] Test error scenarios
- [ ] Test concurrent conversations

---

## 📊 Environment Variables

```env
# Telegram Bot Configuration
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
TELEGRAM_WEBHOOK_SECRET=random_secret_string
BACKEND_URL=https://your-domain.com

# Optional
TELEGRAM_ADMIN_CHAT_ID=your_admin_telegram_id
```

---

## 🚀 Deployment Checklist

- [ ] Register bot with @BotFather
- [ ] Get bot token
- [ ] Set bot commands via BotFather
- [ ] Configure webhook URL
- [ ] Add environment variables
- [ ] Run database migrations
- [ ] Test webhook connectivity
- [ ] Test all bot functions
- [ ] Monitor error logs

---

## 📅 Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| Phase 1 | 3 days | Core bot setup, account linking, ticket creation |
| Phase 2 | 2 days | Notifications, KB search, file attachments |
| Phase 3 | 1 day | Testing, bug fixes, documentation |

**Total Estimated Time: 6 days**

---

## � PHASE 1: Core Bot Setup (3 Days)

### Day 1: Bot Foundation & Module Setup

#### Task 1.1: Register Bot dengan BotFather
```
1. Buka Telegram, cari @BotFather
2. Kirim /newbot
3. Masukkan nama bot: "iDesk Support"
4. Masukkan username: idesk_support_bot
5. Simpan BOT_TOKEN yang diberikan
6. Set commands dengan /setcommands:
   start - Mulai dan lihat menu
   link - Hubungkan akun iDesk
   unlink - Putuskan koneksi akun
   newticket - Buat tiket baru
   mytickets - Lihat tiket saya
   help - Bantuan
```

#### Task 1.2: Install Dependencies
```bash
cd apps/backend
npm install telegraf nestjs-telegraf
npm install @types/node --save-dev
```

#### Task 1.3: Create Telegram Module Structure
```
src/modules/telegram/
├── telegram.module.ts
├── telegram.service.ts
├── telegram.controller.ts
├── telegram.update.ts
├── entities/
│   └── telegram-session.entity.ts
├── dto/
│   └── link-account.dto.ts
└── enums/
    └── telegram-state.enum.ts
```

#### Task 1.4: Create Entity - TelegramSession
```typescript
// telegram-session.entity.ts
@Entity('telegram_session')
export class TelegramSession {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @Column({ type: 'bigint', unique: true })
    telegramId: number;

    @Column({ nullable: true })
    telegramUsername: string;

    @Column({ nullable: true })
    telegramFirstName: string;

    @Column({ type: 'bigint' })
    chatId: number;

    @Column({ nullable: true })
    userId: string;

    @ManyToOne(() => User, { nullable: true })
    @JoinColumn({ name: 'userId' })
    user: User;

    @Column({ default: 'IDLE' })
    state: string;

    @Column({ type: 'jsonb', nullable: true })
    stateData: any;

    @Column({ nullable: true })
    linkedAt: Date;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}
```

#### Task 1.5: Create Telegram Module
```typescript
// telegram.module.ts
@Module({
    imports: [
        TypeOrmModule.forFeature([TelegramSession]),
        TelegrafModule.forRootAsync({
            useFactory: () => ({
                token: process.env.TELEGRAM_BOT_TOKEN,
            }),
        }),
        forwardRef(() => UsersModule),
        forwardRef(() => TicketingModule),
    ],
    providers: [TelegramService, TelegramUpdate],
    controllers: [TelegramController],
    exports: [TelegramService],
})
export class TelegramModule {}
```

#### Task 1.6: Create Basic Service
```typescript
// telegram.service.ts
@Injectable()
export class TelegramService {
    constructor(
        @InjectRepository(TelegramSession)
        private sessionRepo: Repository<TelegramSession>,
        @InjectBot() private bot: Telegraf<Context>,
    ) {}

    async getOrCreateSession(telegramId: number, chatId: number, userData: any) {
        let session = await this.sessionRepo.findOne({ 
            where: { telegramId },
            relations: ['user']
        });
        
        if (!session) {
            session = this.sessionRepo.create({
                telegramId,
                chatId,
                telegramUsername: userData.username,
                telegramFirstName: userData.first_name,
                state: 'IDLE',
            });
            await this.sessionRepo.save(session);
        }
        
        return session;
    }

    async setState(telegramId: number, state: string, data?: any) {
        await this.sessionRepo.update(
            { telegramId },
            { state, stateData: data }
        );
    }

    async sendMessage(chatId: number, message: string, options?: any) {
        return this.bot.telegram.sendMessage(chatId, message, options);
    }
}
```

#### Task 1.7: Create Update Handlers
```typescript
// telegram.update.ts
@Update()
export class TelegramUpdate {
    constructor(private telegramService: TelegramService) {}

    @Start()
    async onStart(@Ctx() ctx: Context) {
        await this.telegramService.getOrCreateSession(
            ctx.from.id,
            ctx.chat.id,
            ctx.from
        );
        
        await ctx.reply(
            '👋 Selamat datang di iDesk Support!\n\n' +
            'Saya dapat membantu Anda:\n' +
            '• Membuat tiket support\n' +
            '• Melacak status tiket\n' +
            '• Mencari artikel bantuan\n\n' +
            'Gunakan /link untuk menghubungkan akun Anda.',
            {
                reply_markup: {
                    inline_keyboard: [
                        [{ text: '🔗 Link Akun', callback_data: 'link' }],
                        [{ text: '❓ Bantuan', callback_data: 'help' }],
                    ]
                }
            }
        );
    }

    @Help()
    async onHelp(@Ctx() ctx: Context) {
        await ctx.reply(
            '📚 Daftar Perintah:\n\n' +
            '/start - Mulai bot\n' +
            '/link - Hubungkan akun iDesk\n' +
            '/unlink - Putuskan koneksi\n' +
            '/newticket - Buat tiket baru\n' +
            '/mytickets - Lihat tiket saya\n' +
            '/help - Tampilkan bantuan ini'
        );
    }
}
```

#### Task 1.8: Register Module in AppModule
```typescript
// app.module.ts
import { TelegramModule } from './modules/telegram/telegram.module';

@Module({
    imports: [
        // ... existing imports
        TelegramModule,
    ],
})
export class AppModule {}
```

---

### Day 2: Account Linking System

#### Task 2.1: Update User Entity
```typescript
// user.entity.ts - tambahkan fields
@Column({ type: 'bigint', nullable: true, unique: true })
telegramId: number;

@Column({ type: 'bigint', nullable: true })
telegramChatId: number;

@Column({ default: true })
telegramNotifications: boolean;
```

#### Task 2.2: Create Link Code System
```typescript
// telegram.service.ts - tambahkan methods

// In-memory store untuk link codes (atau gunakan Redis)
private linkCodes = new Map<string, { 
    odinguserId: string, 
    expiresAt: Date 
}>();

async generateLinkCode(userId: string): Promise<string> {
    // Generate 6-digit code
    const code = Math.random().toString().slice(2, 8);
    
    // Store with 5 minute expiry
    this.linkCodes.set(code, {
        userId,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000)
    });
    
    // Auto cleanup after expiry
    setTimeout(() => this.linkCodes.delete(code), 5 * 60 * 1000);
    
    return code;
}

async verifyAndLink(telegramId: number, code: string): Promise<boolean> {
    const linkData = this.linkCodes.get(code);
    
    if (!linkData || linkData.expiresAt < new Date()) {
        return false;
    }
    
    // Update user with telegram info
    await this.userRepo.update(linkData.userId, {
        telegramId,
        telegramChatId: (await this.sessionRepo.findOne({ 
            where: { telegramId } 
        }))?.chatId
    });
    
    // Update session
    await this.sessionRepo.update(
        { telegramId },
        { userId: linkData.userId, linkedAt: new Date() }
    );
    
    // Remove used code
    this.linkCodes.delete(code);
    
    return true;
}
```

#### Task 2.3: Create Link API Endpoint
```typescript
// telegram.controller.ts
@Controller('telegram')
export class TelegramController {
    constructor(private telegramService: TelegramService) {}

    @Post('generate-link-code')
    @UseGuards(JwtAuthGuard)
    async generateLinkCode(@Req() req) {
        const code = await this.telegramService.generateLinkCode(req.user.userId);
        return { 
            code,
            expiresIn: 300, // 5 minutes
            instruction: 'Kirim kode ini ke bot Telegram @idesk_support_bot'
        };
    }

    @Get('status')
    @UseGuards(JwtAuthGuard)
    async getStatus(@Req() req) {
        const user = await this.userRepo.findOne({ 
            where: { id: req.user.userId } 
        });
        return {
            linked: !!user.telegramId,
            telegramNotifications: user.telegramNotifications,
        };
    }

    @Delete('unlink')
    @UseGuards(JwtAuthGuard)
    async unlink(@Req() req) {
        await this.telegramService.unlinkAccount(req.user.userId);
        return { success: true };
    }
}
```

#### Task 2.4: Implement /link Command Handler
```typescript
// telegram.update.ts - tambahkan
@Command('link')
async onLink(@Ctx() ctx: Context) {
    const session = await this.telegramService.getSession(ctx.from.id);
    
    if (session?.userId) {
        return ctx.reply(
            '✅ Akun Anda sudah terhubung!\n\n' +
            'Gunakan /unlink jika ingin memutuskan koneksi.'
        );
    }
    
    await this.telegramService.setState(ctx.from.id, 'AWAITING_LINK_CODE');
    
    await ctx.reply(
        '🔗 Untuk menghubungkan akun:\n\n' +
        '1. Buka iDesk di browser\n' +
        '2. Pergi ke Settings > Telegram\n' +
        '3. Klik "Generate Link Code"\n' +
        '4. Kirim kode 6 digit ke sini\n\n' +
        'Atau ketik /cancel untuk membatalkan.'
    );
}

@On('text')
async onText(@Ctx() ctx: Context) {
    const session = await this.telegramService.getSession(ctx.from.id);
    const text = ctx.message.text;
    
    // Handle link code verification
    if (session?.state === 'AWAITING_LINK_CODE') {
        if (text === '/cancel') {
            await this.telegramService.setState(ctx.from.id, 'IDLE');
            return ctx.reply('❌ Dibatalkan.');
        }
        
        // Validate 6-digit code
        if (/^\d{6}$/.test(text)) {
            const success = await this.telegramService.verifyAndLink(
                ctx.from.id, 
                text
            );
            
            if (success) {
                await this.telegramService.setState(ctx.from.id, 'IDLE');
                return ctx.reply(
                    '✅ Akun berhasil dihubungkan!\n\n' +
                    'Sekarang Anda dapat:\n' +
                    '• /newticket - Buat tiket baru\n' +
                    '• /mytickets - Lihat tiket Anda'
                );
            } else {
                return ctx.reply(
                    '❌ Kode tidak valid atau sudah kadaluarsa.\n' +
                    'Silakan generate kode baru.'
                );
            }
        }
        
        return ctx.reply('⚠️ Masukkan kode 6 digit yang valid.');
    }
    
    // Handle other states...
}
```

#### Task 2.5: Add Link UI in Frontend Profile Page
```typescript
// ClientProfilePage.tsx - tambahkan section
const [linkCode, setLinkCode] = useState('');
const [telegramStatus, setTelegramStatus] = useState(null);

const generateCode = async () => {
    const res = await api.post('/telegram/generate-link-code');
    setLinkCode(res.data.code);
};

// JSX
<div className="bg-white dark:bg-slate-800 rounded-2xl p-6">
    <h3 className="font-bold text-lg mb-4">Telegram Integration</h3>
    
    {telegramStatus?.linked ? (
        <div>
            <p className="text-green-600">✅ Terhubung dengan Telegram</p>
            <button onClick={unlinkTelegram}>Putuskan Koneksi</button>
        </div>
    ) : (
        <div>
            <p className="mb-4">Hubungkan Telegram untuk notifikasi real-time</p>
            <button onClick={generateCode}>Generate Link Code</button>
            {linkCode && (
                <div className="mt-4 p-4 bg-slate-100 rounded-xl text-center">
                    <p className="text-sm text-slate-500">Kirim kode ini ke bot:</p>
                    <p className="text-3xl font-mono font-bold">{linkCode}</p>
                    <p className="text-xs text-slate-400 mt-2">Berlaku 5 menit</p>
                </div>
            )}
        </div>
    )}
</div>
```

---

### Day 3: Ticket Creation & Management

#### Task 3.1: Implement /newticket Command
```typescript
// telegram.update.ts
@Command('newticket')
async onNewTicket(@Ctx() ctx: Context) {
    const session = await this.telegramService.getSession(ctx.from.id);
    
    if (!session?.userId) {
        return ctx.reply(
            '❌ Anda harus menghubungkan akun terlebih dahulu.\n' +
            'Gunakan /link untuk menghubungkan.'
        );
    }
    
    await this.telegramService.setState(
        ctx.from.id, 
        'CREATING_TICKET_SUBJECT',
        { step: 1 }
    );
    
    await ctx.reply(
        '📝 Membuat Tiket Baru\n\n' +
        'Langkah 1/3: Masukkan judul tiket\n' +
        '(atau /cancel untuk membatalkan)'
    );
}
```

#### Task 3.2: Implement Ticket Creation Flow
```typescript
// telegram.service.ts
async handleTicketCreation(ctx: Context, session: TelegramSession) {
    const text = ctx.message.text;
    const stateData = session.stateData || {};
    
    switch (session.state) {
        case 'CREATING_TICKET_SUBJECT':
            await this.setState(ctx.from.id, 'CREATING_TICKET_DESCRIPTION', {
                ...stateData,
                subject: text
            });
            await ctx.reply(
                '✅ Judul: ' + text + '\n\n' +
                'Langkah 2/3: Jelaskan masalah Anda secara detail'
            );
            break;
            
        case 'CREATING_TICKET_DESCRIPTION':
            await this.setState(ctx.from.id, 'CREATING_TICKET_PRIORITY', {
                ...stateData,
                description: text
            });
            await ctx.reply(
                '✅ Deskripsi disimpan\n\n' +
                'Langkah 3/3: Pilih prioritas:',
                {
                    reply_markup: {
                        inline_keyboard: [
                            [
                                { text: '🟢 Low', callback_data: 'priority_LOW' },
                                { text: '🟡 Medium', callback_data: 'priority_MEDIUM' },
                            ],
                            [
                                { text: '🟠 High', callback_data: 'priority_HIGH' },
                                { text: '🔴 Critical', callback_data: 'priority_CRITICAL' },
                            ],
                        ]
                    }
                }
            );
            break;
    }
}

async createTicketFromTelegram(
    telegramId: number, 
    priority: string
): Promise<Ticket> {
    const session = await this.getSession(telegramId);
    const { subject, description } = session.stateData;
    
    // Create ticket using existing service
    const ticket = await this.ticketService.createTicket({
        subject,
        description,
        priority,
        userId: session.userId,
        source: 'TELEGRAM',
    });
    
    // Reset state
    await this.setState(telegramId, 'IDLE', null);
    
    return ticket;
}
```

#### Task 3.3: Handle Priority Selection Callback
```typescript
// telegram.update.ts
@On('callback_query')
async onCallback(@Ctx() ctx: Context) {
    const data = ctx.callbackQuery.data;
    
    if (data.startsWith('priority_')) {
        const priority = data.replace('priority_', '');
        const ticket = await this.telegramService.createTicketFromTelegram(
            ctx.from.id,
            priority
        );
        
        await ctx.answerCbQuery('Tiket dibuat!');
        await ctx.editMessageText(
            '✅ Tiket Berhasil Dibuat!\n\n' +
            `📋 ID: #${ticket.id.slice(0, 8)}\n` +
            `📌 Judul: ${ticket.subject}\n` +
            `⚡ Prioritas: ${priority}\n` +
            `📊 Status: ${ticket.status}\n\n` +
            'Kami akan segera menghubungi Anda.'
        );
    }
    
    // Handle other callbacks...
}
```

#### Task 3.4: Implement /mytickets Command
```typescript
@Command('mytickets')
async onMyTickets(@Ctx() ctx: Context) {
    const session = await this.telegramService.getSession(ctx.from.id);
    
    if (!session?.userId) {
        return ctx.reply('❌ Hubungkan akun terlebih dahulu dengan /link');
    }
    
    const tickets = await this.ticketService.findByUser(session.userId, {
        take: 5,
        order: { createdAt: 'DESC' }
    });
    
    if (tickets.length === 0) {
        return ctx.reply(
            '📭 Anda belum memiliki tiket.\n\n' +
            'Gunakan /newticket untuk membuat tiket baru.'
        );
    }
    
    const statusEmoji = {
        OPEN: '🟢',
        IN_PROGRESS: '🟡',
        WAITING: '🟠',
        RESOLVED: '✅',
        CLOSED: '⚫'
    };
    
    let message = '📋 Tiket Anda:\n\n';
    const buttons = [];
    
    for (const ticket of tickets) {
        message += `${statusEmoji[ticket.status]} #${ticket.id.slice(0,8)}\n`;
        message += `   ${ticket.subject}\n`;
        message += `   Status: ${ticket.status}\n\n`;
        
        buttons.push([{
            text: `📄 #${ticket.id.slice(0,8)} - ${ticket.subject.slice(0,20)}`,
            callback_data: `ticket_${ticket.id}`
        }]);
    }
    
    await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons }
    });
}
```

#### Task 3.5: Implement Ticket Detail View
```typescript
// Handle ticket_<id> callback
if (data.startsWith('ticket_')) {
    const ticketId = data.replace('ticket_', '');
    const ticket = await this.ticketService.findOne(ticketId);
    
    const statusEmoji = { /* same as above */ };
    const priorityEmoji = {
        LOW: '🟢',
        MEDIUM: '🟡', 
        HIGH: '🟠',
        CRITICAL: '🔴'
    };
    
    await ctx.editMessageText(
        `📋 Detail Tiket #${ticket.id.slice(0,8)}\n\n` +
        `📌 Judul: ${ticket.subject}\n` +
        `${statusEmoji[ticket.status]} Status: ${ticket.status}\n` +
        `${priorityEmoji[ticket.priority]} Prioritas: ${ticket.priority}\n` +
        `📅 Dibuat: ${ticket.createdAt.toLocaleDateString('id-ID')}\n\n` +
        `📝 Deskripsi:\n${ticket.description}`,
        {
            reply_markup: {
                inline_keyboard: [
                    [{ text: '💬 Balas Tiket', callback_data: `reply_${ticketId}` }],
                    [{ text: '◀️ Kembali', callback_data: 'my_tickets' }],
                ]
            }
        }
    );
}
```

#### Task 3.6: Implement Reply to Ticket
```typescript
// Handle reply_<id> callback
if (data.startsWith('reply_')) {
    const ticketId = data.replace('reply_', '');
    
    await this.telegramService.setState(ctx.from.id, 'REPLYING_TO_TICKET', {
        ticketId
    });
    
    await ctx.answerCbQuery();
    await ctx.reply(
        '💬 Ketik balasan Anda untuk tiket ini:\n' +
        '(atau /cancel untuk membatalkan)'
    );
}

// In text handler
if (session.state === 'REPLYING_TO_TICKET') {
    const { ticketId } = session.stateData;
    
    await this.ticketService.replyToTicket(ticketId, {
        content: text,
        senderId: session.userId,
        source: 'TELEGRAM'
    });
    
    await this.telegramService.setState(ctx.from.id, 'IDLE');
    await ctx.reply('✅ Balasan terkirim!');
}
```

---

## 🔷 PHASE 2: Advanced Features (2 Days)

### Day 4: Notifications & Knowledge Base

#### Task 4.1: Integrate with NotificationService
```typescript
// notification.service.ts - update
async createNotification(data: CreateNotificationDto) {
    // ... existing code
    
    // Send Telegram notification if enabled
    if (user.telegramChatId && user.telegramNotifications) {
        await this.telegramService.sendNotification(
            user.telegramChatId,
            this.formatTelegramMessage(notification)
        );
    }
}

private formatTelegramMessage(notification: Notification): string {
    const icons = {
        ticket_created: '🎫',
        ticket_reply: '💬',
        ticket_assigned: '👤',
        ticket_resolved: '✅',
        mention: '📢',
    };
    
    return `${icons[notification.type] || '🔔'} ${notification.title}\n\n${notification.message}`;
}
```

#### Task 4.2: Send Notifications on Ticket Events
```typescript
// ticket.service.ts - update createTicket
async createTicket(data: CreateTicketDto) {
    const ticket = await this.ticketRepo.save(data);
    
    // Notify admins/agents via Telegram
    const agents = await this.userRepo.find({
        where: [
            { role: UserRole.ADMIN },
            { role: UserRole.AGENT }
        ]
    });
    
    for (const agent of agents) {
        if (agent.telegramChatId && agent.telegramNotifications) {
            await this.telegramService.sendMessage(
                agent.telegramChatId,
                `🎫 Tiket Baru!\n\n` +
                `ID: #${ticket.id.slice(0,8)}\n` +
                `Judul: ${ticket.subject}\n` +
                `Prioritas: ${ticket.priority}\n` +
                `Dari: ${ticket.user.fullName}`,
                {
                    reply_markup: {
                        inline_keyboard: [[
                            { text: '👀 Lihat Tiket', callback_data: `view_${ticket.id}` }
                        ]]
                    }
                }
            );
        }
    }
    
    return ticket;
}
```

#### Task 4.3: Implement /search Knowledge Base
```typescript
@Command('search')
async onSearch(@Ctx() ctx: Context) {
    const query = ctx.message.text.replace('/search', '').trim();
    
    if (!query) {
        return ctx.reply(
            '🔍 Cara menggunakan:\n' +
            '/search <kata kunci>\n\n' +
            'Contoh: /search reset password'
        );
    }
    
    const articles = await this.kbService.search(query, { limit: 5 });
    
    if (articles.length === 0) {
        return ctx.reply(
            '❌ Tidak ditemukan artikel untuk: ' + query + '\n\n' +
            'Coba kata kunci lain atau /newticket untuk bantuan.'
        );
    }
    
    let message = `🔍 Hasil pencarian "${query}":\n\n`;
    const buttons = [];
    
    for (const article of articles) {
        message += `📄 ${article.title}\n`;
        message += `   ${article.category}\n\n`;
        
        buttons.push([{
            text: article.title.slice(0, 40),
            url: `${process.env.FRONTEND_URL}/client/kb/articles/${article.id}`
        }]);
    }
    
    await ctx.reply(message, {
        reply_markup: { inline_keyboard: buttons }
    });
}
```

#### Task 4.4: Settings Command
```typescript
@Command('settings')
async onSettings(@Ctx() ctx: Context) {
    const session = await this.telegramService.getSession(ctx.from.id);
    
    if (!session?.userId) {
        return ctx.reply('❌ Hubungkan akun terlebih dahulu dengan /link');
    }
    
    const user = await this.userRepo.findOne({ where: { id: session.userId } });
    
    await ctx.reply(
        '⚙️ Pengaturan Telegram\n\n' +
        `🔔 Notifikasi: ${user.telegramNotifications ? '✅ Aktif' : '❌ Nonaktif'}`,
        {
            reply_markup: {
                inline_keyboard: [[
                    {
                        text: user.telegramNotifications ? '🔕 Matikan Notifikasi' : '🔔 Aktifkan Notifikasi',
                        callback_data: 'toggle_notifications'
                    }
                ], [
                    { text: '🔗 Putuskan Koneksi', callback_data: 'unlink_confirm' }
                ]]
            }
        }
    );
}
```

---

### Day 5: File Attachments & Polish

#### Task 5.1: Handle File Attachments
```typescript
@On('photo')
async onPhoto(@Ctx() ctx: Context) {
    const session = await this.telegramService.getSession(ctx.from.id);
    
    if (session?.state === 'REPLYING_TO_TICKET') {
        const photo = ctx.message.photo[ctx.message.photo.length - 1];
        const file = await ctx.telegram.getFile(photo.file_id);
        const fileUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${file.file_path}`;
        
        // Download and save file
        const savedPath = await this.uploadService.downloadAndSave(fileUrl);
        
        // Add to ticket reply
        await this.ticketService.replyToTicket(session.stateData.ticketId, {
            content: ctx.message.caption || 'Gambar terlampir',
            senderId: session.userId,
            attachments: [savedPath],
            source: 'TELEGRAM'
        });
        
        await this.telegramService.setState(ctx.from.id, 'IDLE');
        await ctx.reply('✅ Gambar dan balasan terkirim!');
    }
}

@On('document')
async onDocument(@Ctx() ctx: Context) {
    // Similar handling for documents
}
```

#### Task 5.2: Error Handling
```typescript
// telegram.update.ts - add error handler
@Catch()
async onError(@Ctx() ctx: Context, error: Error) {
    console.error('Telegram Bot Error:', error);
    
    try {
        await ctx.reply(
            '❌ Maaf, terjadi kesalahan.\n' +
            'Silakan coba lagi atau hubungi support.'
        );
    } catch (e) {
        // Can't send message, log only
    }
}
```

#### Task 5.3: Rate Limiting
```typescript
// telegram.service.ts
private userRateLimits = new Map<number, number[]>();

async checkRateLimit(telegramId: number): Promise<boolean> {
    const now = Date.now();
    const userRequests = this.userRateLimits.get(telegramId) || [];
    
    // Keep only requests from last minute
    const recentRequests = userRequests.filter(t => now - t < 60000);
    
    if (recentRequests.length >= 20) {
        return false; // Rate limited
    }
    
    recentRequests.push(now);
    this.userRateLimits.set(telegramId, recentRequests);
    return true;
}
```

---

## 🔷 PHASE 3: Testing & Documentation (1 Day)

### Day 6: Testing & Deployment

#### Task 6.1: Unit Tests
```typescript
// telegram.service.spec.ts
describe('TelegramService', () => {
    it('should generate 6-digit link code', async () => {
        const code = await service.generateLinkCode('user-123');
        expect(code).toMatch(/^\d{6}$/);
    });
    
    it('should verify valid link code', async () => {
        const code = await service.generateLinkCode('user-123');
        const result = await service.verifyAndLink(12345, code);
        expect(result).toBe(true);
    });
    
    it('should reject expired link code', async () => {
        // Test with expired code
    });
});
```

#### Task 6.2: Integration Tests
```typescript
// telegram.e2e-spec.ts
describe('Telegram Bot (e2e)', () => {
    it('should handle /start command', async () => {
        // Simulate Telegram webhook
    });
    
    it('should create ticket via bot', async () => {
        // Test full flow
    });
});
```

#### Task 6.3: Set Webhook for Production
```bash
# Set webhook URL
curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
    -H "Content-Type: application/json" \
    -d '{"url": "https://your-domain.com/api/telegram/webhook"}'
```

#### Task 6.4: Final Checklist
- [ ] Bot responds to /start
- [ ] Account linking works
- [ ] Ticket creation works
- [ ] Ticket listing works
- [ ] Reply to ticket works
- [ ] Notifications sent correctly
- [ ] KB search works
- [ ] File attachments work
- [ ] Error handling works
- [ ] Rate limiting works
- [ ] Webhook secured

---

## �📚 References

- [Telegraf.js Documentation](https://telegraf.js.org/)
- [NestJS Telegraf](https://github.com/bukhalo/nestjs-telegraf)
- [Telegram Bot API](https://core.telegram.org/bots/api)
- [BotFather Commands](https://core.telegram.org/bots#botfather)
