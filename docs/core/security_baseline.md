# security_baseline.md

## Purpose
Defines mandatory security requirements for all code in this repository.

Security is NOT optional. All code must comply with these rules.

---

## Core Principles

- Never trust user input
- Minimize data exposure
- Use secure defaults
- Fail safely
- Apply principle of least privilege

---

## 1. Authentication & Authorization

- Use established authentication libraries (do NOT build auth from scratch)
- Store passwords using strong hashing (bcrypt, Argon2, or scrypt) with salting
- Implement secure session management (expiration, rotation, invalidation)
- Use JWTs only with proper expiration and validation
- Enforce authentication on ALL protected endpoints
- Implement role-based or permission-based access control (RBAC)
- Follow least privilege for all roles and services
- Implement secure password reset flows (token-based, time-limited)
- Do NOT assume client-side enforcement is sufficient

---

## 2. API Security

- Use HTTPS for ALL communications
- Implement rate limiting on all public endpoints
- Validate and sanitize all inputs
- Enforce authentication and authorization per endpoint
- Configure strict CORS policies (no wildcard origins in production)
- Avoid exposing internal identifiers where possible
- Use strict schemas where possible
- Reject invalid or unexpected inputs
- Validate request payloads
- Use pagination for large data responses

---

## 3. Data Protection

- Encrypt sensitive data at rest and in transit
- Use secure key management (never hardcode keys)
- Only collect/store necessary data
- Implement proper data access controls (e.g., row-level security where applicable)
- Use parameterized queries or ORM to prevent injection
- Implement secure file handling (validate type, size, content)
- Define and enforce data retention policies

---

## 4. Security Headers & Browser Protections

- Implement:
  - Content Security Policy (CSP)
  - X-Frame-Options
  - X-Content-Type-Options
  - Strict-Transport-Security (HSTS)
- Protect against XSS via proper escaping and CSP
- Implement CSRF protection for state-changing requests
- Use secure cookie settings:
  - HttpOnly
  - Secure
  - SameSite

---

## 5. Secrets Management

- Do NOT hardcode secrets, API keys, or credentials
- Never expose API keys in frontend code
- Use environment variables or a secure secrets manager
- Do NOT commit `.env` files
- Maintain `.env.example` without real values

---

## 6. Infrastructure Protection

- Use a Web Application Firewall (WAF) where possible
- Use CDN or cloud protections for DDoS mitigation
- Ensure all external services use HTTPS
- Restrict network access using least privilege (IP allowlists, VPC rules)

---

## 7. Secure Configuration

- Use environment-specific configurations (dev, staging, prod)
- Default to secure settings (fail closed)
- Do NOT enable debug modes in production
- Ensure proper configuration management

---

## 8. Error Handling & Logging

- Do NOT expose stack traces or sensitive data to users
- Return generic error messages to clients
- Log errors securely for debugging
- Do NOT log sensitive data (passwords, tokens, PII)
- Use structured logging where possible
- Ensure logs do not leak secrets

---

## 9. Dependencies

- Use well-maintained, reputable libraries
- Keep dependencies up to date
- Remove unused dependencies
- Monitor for known vulnerabilities (e.g., dependabot, Snyk)

---

## 10. Common Vulnerabilities (Avoid)

- SQL Injection → use parameterized queries / ORM
- XSS → sanitize and escape user input
- CSRF → use tokens and SameSite cookies
- IDOR → enforce access checks
- Open redirects
- Insecure deserialization

---

## 11. Security Testing

- Implement security-focused tests
- Test authentication flows
- Test authorization rules
- Test input validation and sanitization
- Test error handling and failure modes
- Include basic penetration-style checks where possible

---

## Enforcement

- Security issues must be addressed immediately
- Do NOT defer security fixes
- If unsure → choose the safer option

---

## Notes

- Prefer simplicity over complex, error-prone security logic
- Security decisions must be explicit, not assumed
