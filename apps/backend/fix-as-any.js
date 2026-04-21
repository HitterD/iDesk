const fs = require('fs');

const mappings = [
    { file: './src/modules/ict-budget/ict-budget.service.ts', entity: 'IctBudgetRequest', repo: 'requestRepo' },
    { file: './src/modules/ict-budget/ict-budget.service.ts', entity: 'InstallationSchedule', repo: 'scheduleRepo' },
    { file: './src/modules/lost-item/lost-item.service.ts', entity: 'LostItemReport', repo: 'lostItemRepo' },
    { file: './src/modules/renewal/renewal.service.ts', entity: 'RenewalContract', repo: 'contractRepo' },
    { file: './src/modules/ip-whitelist/ip-whitelist.service.ts', entity: 'IpWhitelist', repo: 'whitelistRepo' },
    { file: './src/modules/synology/synology.service.ts', entity: 'BackupConfiguration', repo: 'configRepo' },
    { file: './src/modules/synology/synology.service.ts', entity: 'BackupHistory', repo: 'historyRepo' },
    { file: './src/modules/ticketing/saved-replies.service.ts', entity: 'SavedReply', repo: 'replyRepo' },
    { file: './src/modules/zoom-booking/services/zoom-booking.service.ts', entity: 'ZoomBooking', repo: 'bookingRepo' },
    { file: './src/modules/zoom-booking/services/zoom-booking.service.ts', entity: 'ZoomMeeting', repo: 'meetingRepo' },
    { file: './src/modules/zoom-booking/services/zoom-booking.service.ts', entity: 'ZoomParticipant', repo: 'participantRepo' },
    { file: './src/modules/zoom-booking/services/zoom-booking.service.ts', entity: 'ZoomSettings', repo: 'settingsRepo' },
    { file: './src/modules/zoom-booking/services/zoom-booking.service.ts', entity: 'ZoomAuditLog', repo: 'auditRepo' }
];

for (const m of mappings) {
    if(!fs.existsSync(m.file)) continue;

    let content = fs.readFileSync(m.file, 'utf8');
    
    // Replace "this.repo.create({ ... } as any)" with "this.repo.create({ ... } as Partial<Entity>)"
    // We can do a string replace since we know the repo names
    let search = `this.${m.repo}.create(`;
    let index = 0;
    while((index = content.indexOf(search, index)) !== -1) {
        let blockStart = index + search.length;
        // find "as any);"
        let asAnyIndex = content.indexOf('as any);', blockStart);
        if(asAnyIndex !== -1 && asAnyIndex - blockStart < 5000) { // arbitrary limit to avoid matching wrong one
            // We just replace 'as any)' with `as Partial<${m.entity}>)`
            content = content.substring(0, asAnyIndex) + `as Partial<${m.entity}>);` + content.substring(asAnyIndex + 8);
        }
        index += search.length;
    }
    fs.writeFileSync(m.file, content);
}
