import { BadRequestException } from '@nestjs/common';

type PasswordPolicyConfig = {
  minLength: number;
  requireUpper: boolean;
  requireLower: boolean;
  requireDigit: boolean;
  requireSymbol: boolean;
  expiresDays: number;
};

function toBool(value: string | undefined, defaultValue = false) {
  if (value == null) return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

export function getPasswordPolicy(): PasswordPolicyConfig {
  return {
    minLength: Math.max(6, Number(process.env.AUTH_PASSWORD_MIN_LENGTH || 6)),
    requireUpper: toBool(process.env.AUTH_PASSWORD_REQUIRE_UPPER, false),
    requireLower: toBool(process.env.AUTH_PASSWORD_REQUIRE_LOWER, false),
    requireDigit: toBool(process.env.AUTH_PASSWORD_REQUIRE_DIGIT, false),
    requireSymbol: toBool(process.env.AUTH_PASSWORD_REQUIRE_SYMBOL, false),
    expiresDays: Math.max(
      0,
      Number(process.env.AUTH_PASSWORD_EXPIRES_DAYS || 0),
    ),
  };
}

export function validatePasswordPolicy(password: string) {
  const policy = getPasswordPolicy();
  const issues: string[] = [];

  if (password.length < policy.minLength) {
    issues.push(`ao menos ${policy.minLength} caracteres`);
  }
  if (policy.requireUpper && !/[A-Z]/.test(password)) {
    issues.push('uma letra maiúscula');
  }
  if (policy.requireLower && !/[a-z]/.test(password)) {
    issues.push('uma letra minúscula');
  }
  if (policy.requireDigit && !/[0-9]/.test(password)) {
    issues.push('um número');
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    issues.push('um símbolo');
  }

  if (issues.length > 0) {
    throw new BadRequestException(
      `Senha inválida. A senha deve conter ${issues.join(', ')}.`,
    );
  }
}

export function calculatePasswordExpiresAt(base = new Date()) {
  const { expiresDays } = getPasswordPolicy();
  if (expiresDays <= 0) return null;
  return new Date(base.getTime() + expiresDays * 24 * 60 * 60 * 1000);
}
