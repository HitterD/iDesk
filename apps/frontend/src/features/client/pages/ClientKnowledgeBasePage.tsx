import React from 'react';
import { KnowledgeBaseLanding } from '@/features/knowledge-base/components/KnowledgeBaseLanding';

/**
 * Knowledge base landing page for the end-user portal.
 *
 * Shares one component with the internal portal so the two lists cannot drift
 * apart; only the link prefixes differ, and clients never get author actions.
 */
export const ClientKnowledgeBasePage: React.FC = () => (
    <KnowledgeBaseLanding
        title="Pusat Panduan"
        subtitle="Cari solusi mandiri untuk kendala IT sehari-hari. Jika belum ketemu, buat tiket dan tim kami membantu."
        articleBasePath="/client/kb/articles"
        createTicketPath="/client/create"
    />
);

export default ClientKnowledgeBasePage;
