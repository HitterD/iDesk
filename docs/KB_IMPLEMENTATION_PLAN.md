# Knowledge Base Implementation Plan for IT Support

## Overview
Dokumen ini berisi rencana implementasi fitur Knowledge Base untuk sistem IT Helpdesk.

---

## Phase 1: Article Management (Core CRUD)
**Timeline: 3-4 hari**

### 1.1 Backend - Article CRUD Complete
- [ ] **PUT /kb/articles/:id** - Update artikel
- [ ] **DELETE /kb/articles/:id** - Delete artikel (soft delete)
- [ ] **PATCH /kb/articles/:id/status** - Update status (draft/published/archived)
- [ ] Add `status` field ke Article entity
- [ ] Add `authorId` field untuk tracking pembuat artikel
- [ ] Add validation DTO untuk create/update

**Files to modify:**
- `apps/backend/src/modules/knowledge-base/knowledge-base.controller.ts`
- `apps/backend/src/modules/knowledge-base/knowledge-base.service.ts`
- `apps/backend/src/modules/knowledge-base/entities/article.entity.ts`
- `apps/backend/src/modules/knowledge-base/dto/create-article.dto.ts` (new)
- `apps/backend/src/modules/knowledge-base/dto/update-article.dto.ts` (new)

### 1.2 Frontend - Article Management UI
- [ ] **Create Article Page** (`/kb/create`)
  - Form: title, content, category, tags
  - Rich text editor (TipTap/React-Quill)
  - Preview mode
  - Save as draft / Publish
  
- [ ] **Edit Article Page** (`/kb/articles/:id/edit`)
  - Pre-filled form dengan data existing
  - Update & Delete buttons
  
- [ ] **Admin Article List** (`/kb/manage`)
  - Table view dengan semua artikel
  - Filter: status, category, author
  - Bulk actions: delete, change status

**Files to create:**
- `apps/frontend/src/features/knowledge-base/pages/BentoCreateArticlePage.tsx`
- `apps/frontend/src/features/knowledge-base/pages/BentoEditArticlePage.tsx`
- `apps/frontend/src/features/knowledge-base/pages/BentoManageArticlesPage.tsx`
- `apps/frontend/src/features/knowledge-base/components/ArticleForm.tsx`

---

## Phase 2: Category Management
**Timeline: 2 hari**

### 2.1 Backend - Category Entity & CRUD
- [ ] Create `Category` entity dengan fields: id, name, slug, description, icon, color, order
- [ ] **GET /kb/categories** - List all categories
- [ ] **POST /kb/categories** - Create category
- [ ] **PUT /kb/categories/:id** - Update category
- [ ] **DELETE /kb/categories/:id** - Delete category
- [ ] Update Article entity untuk relasi ke Category

**Files to create:**
- `apps/backend/src/modules/knowledge-base/entities/category.entity.ts`
- `apps/backend/src/modules/knowledge-base/category.controller.ts`
- `apps/backend/src/modules/knowledge-base/category.service.ts`

### 2.2 Frontend - Category Features
- [ ] **Category Sidebar/Tabs** di Knowledge Base page
- [ ] **Category Filter** untuk artikel
- [ ] **Category Management Page** (Admin only)
- [ ] Category badges dengan warna custom

**Files to create:**
- `apps/frontend/src/features/knowledge-base/components/CategorySidebar.tsx`
- `apps/frontend/src/features/knowledge-base/components/CategoryFilter.tsx`
- `apps/frontend/src/features/knowledge-base/pages/BentoCategoryManagePage.tsx`

---

## Phase 3: Popular & Analytics
**Timeline: 2-3 hari**

### 3.1 Backend - Analytics Endpoints
- [ ] **GET /kb/articles/popular** - Top 10 most viewed
- [ ] **GET /kb/articles/recent** - Recently updated
- [ ] **POST /kb/articles/:id/helpful** - Mark as helpful
- [ ] **GET /kb/analytics** - Dashboard stats (total articles, views, helpful count)
- [ ] Add `helpfulCount`, `viewCount` ke Article entity

**Files to modify:**
- `apps/backend/src/modules/knowledge-base/knowledge-base.controller.ts`
- `apps/backend/src/modules/knowledge-base/knowledge-base.service.ts`
- `apps/backend/src/modules/knowledge-base/entities/article.entity.ts`

### 3.2 Frontend - Popular Section
- [ ] **Popular Articles Widget** di KB homepage
- [ ] **Recently Updated Section**
- [ ] **Helpful Button** dengan feedback toast
- [ ] **KB Analytics Dashboard** (Admin)

**Files to create:**
- `apps/frontend/src/features/knowledge-base/components/PopularArticles.tsx`
- `apps/frontend/src/features/knowledge-base/components/RecentArticles.tsx`
- `apps/frontend/src/features/knowledge-base/pages/BentoKBAnalyticsPage.tsx`

---

## Phase 4: Rich Content & Attachments
**Timeline: 3-4 hari**

### 4.1 Backend - File Upload
- [ ] **POST /kb/upload** - Upload gambar/file
- [ ] Configure Multer untuk file storage
- [ ] Add `attachments` field ke Article entity (JSON array)
- [ ] Serve static files dari uploads folder

**Files to create:**
- `apps/backend/src/modules/knowledge-base/upload.controller.ts`
- `apps/backend/src/modules/knowledge-base/upload.service.ts`

### 4.2 Frontend - Rich Editor
- [ ] Integrate **TipTap Editor** atau **React-Quill**
- [ ] Image upload dalam editor
- [ ] Code block dengan syntax highlighting
- [ ] Markdown support
- [ ] Table support

**Dependencies to add:**
```json
{
  "@tiptap/react": "^2.x",
  "@tiptap/starter-kit": "^2.x",
  "@tiptap/extension-image": "^2.x",
  "@tiptap/extension-code-block-lowlight": "^2.x"
}
```

**Files to create:**
- `apps/frontend/src/features/knowledge-base/components/RichTextEditor.tsx`
- `apps/frontend/src/features/knowledge-base/components/ArticleContent.tsx`

---

## Phase 5: Quick Solutions & FAQ
**Timeline: 2 hari**

### 5.1 Backend - FAQ Entity
- [ ] Create `FAQ` entity: id, question, answer, category, order
- [ ] **GET /kb/faq** - List FAQ
- [ ] **POST /kb/faq** - Create FAQ
- [ ] **PUT /kb/faq/:id** - Update FAQ
- [ ] **DELETE /kb/faq/:id** - Delete FAQ

### 5.2 Frontend - FAQ Section
- [ ] **FAQ Accordion Component**
- [ ] **Quick Solutions Section** di KB homepage
- [ ] **FAQ Management Page** (Admin)
- [ ] Searchable FAQ

**Files to create:**
- `apps/frontend/src/features/knowledge-base/components/FAQSection.tsx`
- `apps/frontend/src/features/knowledge-base/components/QuickSolutions.tsx`
- `apps/frontend/src/features/knowledge-base/pages/BentoFAQManagePage.tsx`

---

## Phase 6: Related Articles & Linking
**Timeline: 2 hari**

### 6.1 Backend
- [ ] Add `relatedArticles` field (many-to-many self-reference)
- [ ] **GET /kb/articles/:id/related** - Get related articles
- [ ] Auto-suggest based on tags/category

### 6.2 Frontend
- [ ] **Related Articles Widget** di article detail
- [ ] **Article Link Picker** di editor
- [ ] "See Also" section

---

## Phase 7: Access Control & Internal Articles
**Timeline: 1-2 hari**

### 7.1 Backend
- [ ] Add `visibility` field: 'public' | 'internal' | 'private'
- [ ] Filter articles based on user role
- [ ] Internal articles hanya untuk ADMIN/AGENT

### 7.2 Frontend
- [ ] Visibility selector di article form
- [ ] Badge indicator untuk internal articles
- [ ] Filter by visibility

---

## Phase 8: Export & Integration
**Timeline: 2 hari**

### 8.1 Features
- [ ] **Print to PDF** - Client-side PDF generation
- [ ] **Copy Link** - Share article link
- [ ] **Insert to Ticket** - Quick insert article ke ticket response
- [ ] **Email Article** - Send article via email

**Dependencies:**
```json
{
  "html2pdf.js": "^0.10.x"
}
```

---

## Database Schema Changes

### Article Entity (Updated)
```typescript
@Entity('articles')
export class Article {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  title: string;

  @Column('text')
  content: string;

  @Column({ default: 'General' })
  category: string;

  @Column('simple-array', { nullable: true })
  tags: string[];

  @Column({ default: 'draft' })
  status: 'draft' | 'published' | 'archived';

  @Column({ default: 'public' })
  visibility: 'public' | 'internal' | 'private';

  @Column({ default: 0 })
  viewCount: number;

  @Column({ default: 0 })
  helpfulCount: number;

  @Column('simple-json', { nullable: true })
  attachments: string[];

  @ManyToOne(() => User)
  author: User;

  @Column({ nullable: true })
  authorId: string;

  @ManyToMany(() => Article)
  @JoinTable()
  relatedArticles: Article[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date;
}
```

### Category Entity (New)
```typescript
@Entity('kb_categories')
export class Category {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ unique: true })
  slug: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  icon: string;

  @Column({ default: '#6366f1' })
  color: string;

  @Column({ default: 0 })
  order: number;

  @OneToMany(() => Article, article => article.categoryEntity)
  articles: Article[];

  @CreateDateColumn()
  createdAt: Date;
}
```

---

## Route Updates (App.tsx)

```tsx
// Knowledge Base Routes
<Route path="kb" element={<BentoKnowledgeBasePage />} />
<Route path="kb/articles/:id" element={<BentoArticleDetailPage />} />
<Route path="kb/create" element={<BentoCreateArticlePage />} />
<Route path="kb/articles/:id/edit" element={<BentoEditArticlePage />} />
<Route path="kb/manage" element={<BentoManageArticlesPage />} />
<Route path="kb/categories" element={<BentoCategoryManagePage />} />
<Route path="kb/faq" element={<BentoFAQManagePage />} />
<Route path="kb/analytics" element={<BentoKBAnalyticsPage />} />
```

---

## Priority & Timeline Summary

| Phase | Feature | Priority | Est. Time | Status |
|-------|---------|----------|-----------|--------|
| 1 | Article Management CRUD | 🔴 High | 3-4 days | Pending |
| 2 | Category Management | 🔴 High | 2 days | Pending |
| 3 | Popular & Analytics | 🟡 Medium | 2-3 days | Pending |
| 4 | Rich Content Editor | 🟡 Medium | 3-4 days | Pending |
| 5 | Quick Solutions & FAQ | 🟡 Medium | 2 days | Pending |
| 6 | Related Articles | 🟢 Low | 2 days | Pending |
| 7 | Access Control | 🟡 Medium | 1-2 days | Pending |
| 8 | Export & Integration | 🟢 Low | 2 days | Pending |

**Total Estimated Time: 17-23 days**

---

## Next Steps
1. Review dan approval dari stakeholder
2. Mulai Phase 1: Article Management CRUD
3. Setup database migration untuk schema changes
4. Install dependencies yang diperlukan

---

*Document Version: 1.0*
*Created: November 2024*
*Author: IT Development Team*
