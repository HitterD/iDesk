import { UserRole } from '../../users/enums/user-role.enum';

/** IT staff who process requests (review, remind, import paper signatures, later steps). Credential readers stay ICT_ROLES. */
export const REQUEST_PROCESSOR_ROLES: readonly UserRole[] = [
    UserRole.ADMIN,
    UserRole.AGENT_ADMIN,
    UserRole.AGENT_OPERATIONAL_SUPPORT,
    UserRole.AGENT,
];

/** Who besides the requester and the flow's approvers may open a request's document (site isolation applies on top). */
export const REQUEST_DOCUMENT_VIEWER_ROLES: readonly UserRole[] = [...REQUEST_PROCESSOR_ROLES, UserRole.MANAGER];
