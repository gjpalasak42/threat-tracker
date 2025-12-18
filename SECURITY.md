# Security Policy

## Supported Versions

We take security seriously. This section outlines which versions of Threat Tracker are currently supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability within Threat Tracker, please send an email to the repository owner. All security vulnerabilities will be promptly addressed.

**Please do not report security vulnerabilities through public GitHub issues.**

### What to Include

When reporting a vulnerability, please include:

1. A description of the vulnerability
2. Steps to reproduce the issue
3. Possible impacts of the vulnerability
4. Any suggestions for fixing the issue (optional)

### Response Timeline

- **Initial Response**: Within 48 hours
- **Status Update**: Within 7 days
- **Fix Timeline**: Depends on severity and complexity

### Security Best Practices

When deploying Threat Tracker:

1. **Never use default credentials** - Always change default passwords in `.env.example`
2. **Use strong passwords** - Generate random, complex passwords for production
3. **Enable HTTPS** - Always use TLS/SSL in production environments
4. **Keep dependencies updated** - Regularly run `npm audit` and update packages
5. **Restrict database access** - Don't expose PostgreSQL port (5432) publicly
6. **Use environment variables** - Never commit secrets to version control
7. **Regular backups** - Implement regular database backup procedures
8. **Monitor logs** - Set up logging and monitoring for security events

### Security Features

Threat Tracker includes several security features:

- Security headers (HSTS, X-Frame-Options, CSP, etc.)
- Non-root container execution
- Input validation and sanitization
- Parameterized database queries (via Drizzle ORM)
- Health check endpoints for monitoring
- Docker security hardening (capability dropping, read-only filesystems)

## Acknowledgments

We appreciate the security research community's efforts in responsibly disclosing vulnerabilities.
