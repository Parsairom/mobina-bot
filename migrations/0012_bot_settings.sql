-- Simple key/value settings, currently used for the admin's on/off switch
-- ("bot_enabled"). A missing row means the default (enabled).
CREATE TABLE IF NOT EXISTS bot_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);
