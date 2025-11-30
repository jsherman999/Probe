# Contributing to Probe

Thank you for your interest in contributing to Probe! This document provides guidelines and instructions for contributing.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Coding Standards](#coding-standards)
- [Testing Guidelines](#testing-guidelines)
- [Commit Messages](#commit-messages)
- [Pull Request Process](#pull-request-process)

## Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inspiring community for all. Please be respectful and constructive in all interactions.

### Expected Behavior

- Be respectful of differing viewpoints
- Accept constructive criticism gracefully
- Focus on what is best for the community
- Show empathy towards other community members

## Getting Started

1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR-USERNAME/Probe.git
   cd Probe
   ```

2. **Set up development environment**
   ```bash
   ./scripts/setup.sh
   ```

3. **Create a feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Project Structure

```
Probe/
├── backend/          # Node.js backend
├── frontend/         # React frontend
├── containers/       # Container configurations
├── scripts/          # Automation scripts
└── docs/            # Documentation
```

### Running the Application

```bash
# Start backend and frontend
./scripts/start.sh

# Run tests
./scripts/test.sh

# Check code quality
./scripts/lint.sh
```

## Coding Standards

### TypeScript

- Use TypeScript for all new code
- Enable strict mode
- Avoid `any` types when possible
- Document complex functions with JSDoc comments

### React Components

- Use functional components with hooks
- Keep components small and focused
- Use TypeScript interfaces for props
- Follow the file naming convention: `ComponentName.tsx`

### Backend Code

- Follow REST API best practices
- Use async/await for asynchronous code
- Handle errors appropriately
- Validate all inputs

### Code Formatting

```bash
# Auto-format code
npx prettier --write "**/*.{ts,tsx,js,jsx,json,md}"

# Check formatting
npx prettier --check "**/*.{ts,tsx,js,jsx,json,md}"
```

### Linting

```bash
# Run ESLint
./scripts/lint.sh

# Fix auto-fixable issues
npx eslint --fix "**/*.{ts,tsx}"
```

## Testing Guidelines

### Unit Tests

- Write tests for all new features
- Test edge cases and error conditions
- Use descriptive test names
- Aim for >80% code coverage

```bash
# Run unit tests
npm test

# Run with coverage
npm run test:coverage
```

### Test Structure

```typescript
describe('Component/Function Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = functionUnderTest(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

### Integration Tests

- Test API endpoints end-to-end
- Test WebSocket connections
- Verify database interactions

### Manual Testing

Before submitting a PR:
- [ ] Test on Chrome/Safari
- [ ] Test on mobile (iPhone/Android)
- [ ] Test with 2, 3, and 4 players
- [ ] Test game reconnection
- [ ] Test error scenarios

## Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(game): add turn timer functionality

Implements a 60-second countdown timer for each turn.
Includes visual progress bar and audio warning.

Closes #123
```

```
fix(socket): prevent duplicate connections

Users were creating multiple socket connections on page reload.
Added connection check before creating new socket.

Fixes #456
```

## Pull Request Process

### Before Submitting

1. **Update your branch**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Run tests**
   ```bash
   ./scripts/test.sh
   ```

3. **Check code quality**
   ```bash
   ./scripts/lint.sh
   ```

4. **Update documentation**
   - Update README if needed
   - Add JSDoc comments
   - Update CHANGELOG.md

### PR Checklist

- [ ] Code follows project style guidelines
- [ ] All tests pass
- [ ] New tests added for new features
- [ ] Documentation updated
- [ ] No console.log statements
- [ ] Commit messages follow convention
- [ ] Branch is up to date with main

### PR Description Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How has this been tested?

## Screenshots (if applicable)
Add screenshots for UI changes

## Related Issues
Closes #123
```

### Review Process

1. Automated checks must pass (tests, linting)
2. At least one approval from maintainers
3. All conversations resolved
4. No merge conflicts

## Feature Requests

Submit feature requests via GitHub Issues:

1. Search existing issues first
2. Use the feature request template
3. Provide clear use cases
4. Be open to discussion

## Bug Reports

Submit bugs via GitHub Issues:

1. Check if bug already reported
2. Use the bug report template
3. Provide reproduction steps
4. Include error messages/screenshots
5. Specify environment (OS, browser, etc.)

## Questions?

- Open a GitHub Discussion
- Check existing documentation
- Review closed issues

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing to Probe! 🎮
