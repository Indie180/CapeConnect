# Contributing to CapeConnect

## Development Workflow

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/your-feature`
3. Make your changes
4. Run tests: `npm test`
5. Run linter: `npm run lint`
6. Commit with clear messages
7. Push and create a Pull Request

## Code Standards

### Backend (Node.js)

- Use ES modules (import/export)
- Follow ESLint configuration
- Add JSDoc comments for functions
- Use async/await over callbacks
- Validate inputs with Zod schemas
- Handle errors properly with try/catch

### Frontend (React)

- Use functional components with hooks
- Follow ESLint configuration
- Use meaningful component names
- Keep components small and focused
- Use proper prop types

## Testing

- Write tests for new features
- Ensure existing tests pass
- Aim for meaningful test coverage

## Commit Messages

Follow conventional commits:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes
- `refactor:` Code refactoring
- `test:` Test changes
- `chore:` Build/tooling changes

Example: `feat: add wallet top-up validation`

## Pull Request Process

1. Update documentation if needed
2. Add tests for new functionality
3. Ensure CI passes
4. Request review from maintainers
5. Address review feedback
6. Squash commits if requested

## Questions?

Open an issue for discussion before major changes.
