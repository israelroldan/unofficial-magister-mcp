# Contributing to unofficial-magister-mcp

Thank you for your interest in contributing! This document provides guidelines for contributing to this project.

## Development Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/israelroldan/unofficial-magister-mcp.git
   cd unofficial-magister-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env with your Magister credentials
   ```

4. **Run in development mode**
   ```bash
   npm run dev
   ```

## Code Style

This project uses ESLint and Prettier for code quality and formatting:

```bash
# Check linting
npm run lint

# Auto-fix linting issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run type-check
```

Pre-commit hooks will automatically run linting and formatting on staged files.

## Commit Messages

This project follows [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation changes
- `chore:` - Maintenance tasks
- `refactor:` - Code refactoring
- `test:` - Test additions/changes

Examples:
```
feat: add homework fetching tool
fix: handle expired auth tokens gracefully
docs: add troubleshooting section to README
```

## Pull Request Process

1. Fork the repository
2. Create a feature branch (`git checkout -b feat/my-feature`)
3. Make your changes
4. Ensure linting passes (`npm run lint`)
5. Commit with conventional commit messages
6. Push to your fork
7. Open a Pull Request

## Testing

Currently, the project doesn't have automated tests. When testing manually:

1. Ensure you have valid Magister credentials
2. Run `npm run dev` to start the server
3. Test with an MCP client like Claude Code

## Reporting Issues

When reporting issues, please include:

1. Node.js version (`node --version`)
2. Operating system
3. Steps to reproduce
4. Expected vs actual behavior
5. Relevant log output from `/tmp/magister-mcp.log`

## Security

- **Never commit credentials** - Use `.env` files (gitignored)
- **Don't commit auth state** - `.auth-state.json` is gitignored
- Report security issues privately via GitHub Security Advisories

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
