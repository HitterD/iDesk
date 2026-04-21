# TASK LIST: E-Form Access Portal (VPN MVP)
> Mengikuti metodologi **Superpowers Skill 2 (Writing Plans)**.
> Setiap tugas dirancang untuk durasi 2–5 menit.

---

## 🛠️ PHASE 1: DATABASE & BACKEND CORE

### Batch 1: Database Entities & Module Registration

**Task 1: Create EFormRequest Entity**
File: `apps/backend/src/modules/eform-request/entities/eform-request.entity.ts`
Test: `npm run test:e2e` (Verify entity is registered in TypeORM metadata)
Implementation:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany, JoinColumn } from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { EFormApproval } from './eform-approval.entity';
import { EFormSignature } from './eform-signature.entity';

export enum EFormStatus {
  DRAFT = 'DRAFT',
  PENDING_MANAGER = 'PENDING_MANAGER',
  PENDING_ICT = 'PENDING_ICT',
  CONFIRMED = 'CONFIRMED',
  REJECTED = 'REJECTED'
}

@Entity('eform_requests')
export class EFormRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ default: 'VPN' })
  formType: string;

  @Column({ type: 'enum', enum: EFormStatus, default: EFormStatus.DRAFT })
  status: EFormStatus;

  @Column()
  requesterId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'requesterId' })
  requester: User;

  @Column()
  requesterName: string;

  @Column({ nullable: true })
  requesterEmail: string;

  @Column({ nullable: true })
  requesterJobTitle: string;

  @Column({ nullable: true })
  requesterDepartment: string;

  @Column({ type: 'jsonb', nullable: true })
  formData: any;

  @Column({ default: false })
  termsAccepted: boolean;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string;

  @Column({ nullable: true })
  currentApproverId: string;

  @ManyToOne(() => User, { nullable: true })
  @JoinColumn({ name: 'currentApproverId' })
  currentApprover: User;

  @Column({ type: 'timestamp', nullable: true })
  submittedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  resolvedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToMany(() => EFormApproval, (approval) => approval.eformRequest)
  approvals: EFormApproval[];

  @OneToMany(() => EFormSignature, (signature) => signature.eformRequest)
  signatures: EFormSignature[];
}
```
Verification: File tersimpan dan tidak ada error sintaks.

---

**Task 2: Create EFormApproval Entity**
File: `apps/backend/src/modules/eform-request/entities/eform-approval.entity.ts`
Test: `npm run test:e2e` (Verify entity is registered)
Implementation:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_approvals')
export class EFormApproval {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, (request) => request.approvals, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column()
  approverId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'approverId' })
  approver: User;

  @Column()
  role: string; // REQUESTER | MANAGER | ICT_ADMIN

  @Column({ default: 'PENDING' })
  action: string; // PENDING | APPROVED | REJECTED

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamp', nullable: true })
  actionAt: Date;

  @Column()
  sequence: number;
}
```
Verification: File tersimpan.

---

**Task 3: Create EFormSignature Entity**
File: `apps/backend/src/modules/eform-request/entities/eform-signature.entity.ts`
Test: `npm run test:e2e` (Verify entity is registered)
Implementation:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_signatures')
export class EFormSignature {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, (request) => request.signatures, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column()
  signerId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'signerId' })
  signer: User;

  @Column()
  signerName: string;

  @Column({ type: 'text' })
  signatureData: string; // Base64 PNG

  @Column()
  signerRole: string;

  @CreateDateColumn()
  signedAt: Date;
}
```
Verification: File tersimpan.

---

**Task 4: Create EFormCredential Entity**
File: `apps/backend/src/modules/eform-request/entities/eform-credential.entity.ts`
Test: `npm run test:e2e` (Verify entity is registered)
Implementation:
```typescript
import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, CreateDateColumn } from 'typeorm';
import { EFormRequest } from './eform-request.entity';
import { User } from '../../users/entities/user.entity';

@Entity('eform_credentials')
export class EFormCredential {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  eformRequestId: string;

  @ManyToOne(() => EFormRequest, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'eformRequestId' })
  eformRequest: EFormRequest;

  @Column({ type: 'text' })
  encryptedUsername: string;

  @Column({ type: 'text' })
  encryptedPassword: string;

  @Column()
  iv: string;

  @Column()
  authTag: string;

  @Column()
  provisionedById: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'provisionedById' })
  provisionedBy: User;

  @CreateDateColumn()
  provisionedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessCreatedAt: Date;

  @Column({ type: 'timestamp', nullable: true })
  accessExpiresAt: Date;
}
```
Verification: File tersimpan.

---

**Task 5: Export Entities via Index**
File: `apps/backend/src/modules/eform-request/entities/index.ts`
Implementation:
```typescript
export * from './eform-request.entity';
export * from './eform-approval.entity';
export * from './eform-signature.entity';
export * from './eform-credential.entity';
```
Verification: File tersimpan.

---

**Task 6: Create Module Skeleton**
File: `apps/backend/src/modules/eform-request/eform-request.module.ts`
Implementation:
```typescript
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EFormRequest, EFormApproval, EFormSignature, EFormCredential } from './entities';
import { EFormRequestService } from './eform-request.service';
import { EFormCredentialService } from './eform-credential.service';
import { EFormRequestController } from './eform-request.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      EFormRequest,
      EFormApproval,
      EFormSignature,
      EFormCredential,
    ]),
  ],
  controllers: [EFormRequestController],
  providers: [EFormRequestService, EFormCredentialService],
  exports: [EFormRequestService],
})
export class EFormRequestModule {}
```
Verification: NestJS module created.

---

**Task 7: Register Module in AppRoot**
File: `apps/backend/src/app.module.ts`
Implementation:
Cari bagian imports dan tambahkan `EFormRequestModule`.
Verification: `npm run build` backend tidak ada error circular dependency.

---

### Batch 2: DTOs & Validation

**Task 8: Create CreateEFormRequestDto**
File: `apps/backend/src/modules/eform-request/dto/create-eform-request.dto.ts`
Implementation:
```typescript
import { IsString, IsNotEmpty, IsOptional, IsBoolean, IsObject, IsUUID } from 'class-validator';

export class CreateEFormRequestDto {
  @IsString()
  @IsNotEmpty()
  formType: string;

  @IsObject()
  @IsNotEmpty()
  formData: any;

  @IsBoolean()
  @IsNotEmpty()
  termsAccepted: boolean;

  @IsString()
  @IsNotEmpty()
  signatureData: string;

  @IsUUID()
  @IsNotEmpty()
  managerId: string;
}
```
Verification: DTO siap digunakan di controller.

---

### Batch 3: Encryption Service (AES-256-GCM)

**Task 9: Implement EFormCredentialService**
File: `apps/backend/src/modules/eform-request/eform-credential.service.ts`
Implementation:
```typescript
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class EFormCredentialService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key = Buffer.from(process.env.EFORM_ENCRYPTION_KEY || '0'.repeat(64), 'hex');

  encrypt(text: string): { ciphertext: string; iv: string; authTag: string } {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    let ciphertext = cipher.update(text, 'utf8', 'hex');
    ciphertext += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');
    return { ciphertext, iv: iv.toString('hex'), authTag };
  }

  decrypt(ciphertext: string, iv: string, authTag: string): string {
    const decipher = crypto.createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');
    return plaintext;
  }
}
```
Verification: Unit test manual `encrypt` -> `decrypt` menghasilkan string yang sama.

---

*(Lanjut ke Batch 4-6 pada sesi pengerjaan berikutnya jika disetujui)*
