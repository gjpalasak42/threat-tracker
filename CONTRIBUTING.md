# Contributing to Threat Tracker

Thank you for considering contributing to Threat Tracker! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Provide constructive feedback
- Focus on what is best for the community
- Show empathy towards other community members

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check existing issues to avoid duplicates. When creating a bug report, include:

- A clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots (if applicable)
- Your environment (OS, Node version, etc.)

### Suggesting Enhancements

Enhancement suggestions are welcome! Please provide:

- A clear and descriptive title
- Detailed description of the proposed feature
- Use cases and benefits
- Any potential drawbacks or considerations

### Pull Requests

1. **Fork the repository** and create your branch from `main`
2. **Follow the coding style** used throughout the project
3. **Write clear commit messages** that describe your changes
4. **Add tests** if you're adding new functionality
5. **Update documentation** if needed
6. **Ensure all tests pass** before submitting

### Development Setup

```bash
# Clone your fork
git clone https://github.com/your-username/threat-tracker.git
cd threat-tracker

# Install dependencies
bun install

# Copy environment file
cp .env.example .env

# Start development server
bun run dev
```

### Coding Standards

- **TypeScript**: Use TypeScript for all new code
- **Formatting**: Code will be checked by ESLint
- **Comments**: Add JSDoc comments for public APIs
- **Testing**: Write tests for new features
- **Security**: Follow security best practices

### Commit Message Format

```
type(scope): brief description

Longer description if needed

- bullet points for details
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`

Examples:
- `feat(api): add endpoint for threat log deletion`
- `fix(db): resolve connection pool leak`
- `docs(readme): update installation instructions`

### Code Review Process

1. All submissions require review
2. Maintainers will review PRs as time permits
3. Address review comments promptly
4. Once approved, maintainers will merge your PR

## Project Structure

```
threat-tracker/
├── app/              # Next.js app directory (pages, API routes)
├── components/       # React components
├── src/db/          # Database configuration and schema
├── lib/             # Utility functions
├── public/          # Static assets
└── drizzle/         # Database migrations
```

## Questions?

Feel free to open an issue for questions or reach out to the maintainers.

Thank you for contributing! 🎉
