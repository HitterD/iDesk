import React from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '@/stores/useAuth';
import { KnowledgeBaseLanding } from '../components/KnowledgeBaseLanding';

/** Roles the backend actually accepts on POST /kb/articles (see knowledge-base.controller.ts). */
const AUTHOR_ROLES = ['ADMIN', 'AGENT'];

/**
 * Knowledge base landing page for internal portals.
 *
 * Mounted twice — at /kb for admin/agent and at /manager/kb for managers — so
 * the link prefix is derived from the current path instead of hardcoded, which
 * previously sent managers out of their own portal.
 */
export const BentoKnowledgeBasePage: React.FC = () => {
    const { pathname } = useLocation();
    const { user } = useAuth();

    const isManagerPortal = pathname.startsWith('/manager');
    const canAuthor = AUTHOR_ROLES.includes(user?.role ?? '');

    return (
        <KnowledgeBaseLanding
            title="Pusat Panduan"
            subtitle="Cari solusi mandiri untuk kendala IT sehari-hari. Jika belum ketemu, buat tiket dan tim kami membantu."
            articleBasePath={isManagerPortal ? '/manager/kb/articles' : '/kb/articles'}
            createTicketPath="/tickets/create"
            actions={
                canAuthor
                    ? { createArticlePath: '/kb/create', managePath: '/kb/manage' }
                    : undefined
            }
        />
    );
};

export default BentoKnowledgeBasePage;
