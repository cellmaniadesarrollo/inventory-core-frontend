export const GROUPS = {
  COMPANY_ADMIN: 'COMPANY_ADMIN',
  ADMINS: 'ADMINS',
  CASHIERS: 'CASHIERS',
} as const;

export const ADMIN_GROUPS: readonly string[] = [GROUPS.COMPANY_ADMIN, GROUPS.ADMINS];