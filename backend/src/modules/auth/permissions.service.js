const PERMISSIONS = Object.freeze({
  POSTS_VIEW: "posts.view",
  POSTS_CREATE: "posts.create",
  POSTS_SCHEDULE: "posts.schedule",
  POSTS_PUBLISH_NOW: "posts.publish_now",
  POSTS_CANCEL: "posts.cancel",
  METRICS_VIEW: "metrics.view",
  METRICS_COLLECT: "metrics.collect",
  INBOX_VIEW: "inbox.view",
  INBOX_REPLY: "inbox.reply",
  INBOX_MANAGE_TESTERS: "inbox.manage_testers",
  ACCOUNTS_MANAGE: "accounts.manage",
  USERS_MANAGE: "users.manage",
  SCHEDULE_SLOTS_MANAGE: "schedule_slots.manage",
  MEDIA_TEMPLATES_VIEW: "media_templates.view",
  MEDIA_TEMPLATES_CREATE: "media_templates.create",
  MEDIA_TEMPLATES_UPDATE: "media_templates.update",
  MEDIA_TEMPLATES_APPROVE: "media_templates.approve",
  MEDIA_TEMPLATES_GENERATE_AI_TEXT: "media_templates.generate_ai_text",
  MEDIA_TEMPLATES_CREATE_POST: "media_templates.create_post",
  AI_CREDENTIALS_VIEW: "ai_credentials.view",
  AI_CREDENTIALS_MANAGE: "ai_credentials.manage",
});

const ROLE_PERMISSIONS = Object.freeze({
  admin: Object.freeze(Object.values(PERMISSIONS)),
  operator: Object.freeze([
    PERMISSIONS.POSTS_VIEW,
    PERMISSIONS.POSTS_CREATE,
    PERMISSIONS.POSTS_SCHEDULE,
    PERMISSIONS.POSTS_PUBLISH_NOW,
    PERMISSIONS.POSTS_CANCEL,
    PERMISSIONS.INBOX_VIEW,
    PERMISSIONS.MEDIA_TEMPLATES_VIEW,
    PERMISSIONS.MEDIA_TEMPLATES_CREATE_POST,
  ]),
});

function getRolePermissions(role) {
  return [...(ROLE_PERMISSIONS[role] ?? [])];
}

function hasPermission(role, permission) {
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

module.exports = {
  PERMISSIONS,
  getRolePermissions,
  hasPermission,
};
