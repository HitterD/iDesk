/**
 * Roles of the Hardware Request module. Keep this a plain two-member string enum: members initialised with
 * `'ICT_STAFF' as any` (the old ICT_LEAD / ICT_PROCUREMENT / ICT_TECHNICIAN aliases) make TypeScript emit a reverse
 * mapping that overwrote `HardwareRole.ICT_STAFF` with the alias name at runtime, so every `=== 'ICT_STAFF'` check
 * failed for real users (ICT could not cancel a request or start an installation).
 */
export enum HardwareRole {
    USER = 'USER',
    ICT_STAFF = 'ICT_STAFF',
}
