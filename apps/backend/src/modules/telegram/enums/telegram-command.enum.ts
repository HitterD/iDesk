export enum TelegramCommand {
    START = 'start',
    HELP = 'help',
    TIKET = 'tiket',
    TICKET = 'ticket',
    LIST = 'list',
    MYTICKETS = 'mytickets',
    STATUS = 'status',
    CHAT = 'chat',
    END = 'end',
    ENDCHAT = 'endchat',
    LINK = 'link',
    UNLINK = 'unlink',
    PRIORITY = 'priority',
    CARI = 'cari',
    SEARCH = 'search',
    BAHASA = 'bahasa',
    LANGUAGE = 'language',
    SETTINGS = 'settings',
    CANCEL = 'cancel',
    // Agent commands
    QUEUE = 'queue',
    ASSIGN = 'assign',
    RESOLVE = 'resolve',
    STATS = 'stats',
}

export enum CallbackAction {
    // Navigation
    MAIN_MENU = 'main_menu',
    MY_TICKETS = 'my_tickets',
    SETTINGS = 'settings',
    HELP = 'help',
    
    // Ticket
    NEW_TICKET = 'new_ticket',
    NEW_TICKET_WEBAPP = 'new_ticket_webapp',
    TICKET_QUICK_GUIDE = 'ticket_quick_guide',
    TICKET_WIZARD = 'ticket_wizard',
    VIEW_TICKET = 'view_ticket',
    TICKET_ACTIONS = 'ticket_actions',
    
    // Chat
    START_CHAT = 'start_chat',
    ENTER_CHAT = 'enter_chat',
    EXIT_CHAT = 'exit_chat',
    QUICK_REPLY = 'quick_reply',
    
    // Priority
    CHANGE_PRIORITY = 'change_priority',
    SET_PRIORITY = 'set_priority',
    
    // Category
    SELECT_CATEGORY = 'select_category',
    SELECT_PRIORITY = 'select_priority',
    
    // Link
    ENTER_CODE = 'enter_code',
    
    // Agent
    ASSIGN_TICKET = 'assign_ticket',
    RESOLVE_TICKET = 'resolve_ticket',
    AGENT_QUICK_REPLIES = 'agent_quick_replies',
    SEND_QUICK_REPLY = 'send_quick',
    
    // Survey
    SURVEY_RATING = 'survey_rating',
    SKIP_SURVEY = 'skip_survey',
    
    // Settings
    TOGGLE_NOTIFICATIONS = 'toggle_notifications',
    CHANGE_LANGUAGE = 'change_language',
    SET_LANGUAGE = 'set_language',
    SET_QUIET_HOURS = 'set_quiet_hours',
    
    // General
    CANCEL = 'cancel',
    CHECK_STATUS = 'check_status',
}
