# Contributing

## Reporting Issues & Feature Requests

We use structured templates to streamline communication and ensure consistency:

- **Bug Reports:** Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when you would like to report defects or bugs in the application.
- **Feature Requests:** Use the [feature request template](.github/ISSUE_TEMPLATE/feature_request.md) to request new features or enhancements.
- **Tasks:** Use the [task tracking template](.github/ISSUE_TEMPLATE/task_tracking.md) to track any other development-related tasks.

## Development

To contribute effectively, it's important to set up your development environment correctly. For detailed instructions, please refer to the [README file](README.md). Below are additional guidelines to ensure consistency and quality in your contributions:

### Style Guide

Please follow general best practices for coding and follow established patterns in the codebase.

#### Naming Conventions

- **PascalCase**: For components, classes, types, interfaces, table names in the database, and the names of Typescript files with JSX (.tsx).
- **camelCase**: For variables, functions, and parameters. Also for DAL filenames and column names in the database.
- **UPPER_SNAKE_CASE**: For constants declared outside of functions.
- **lower_snake_case**: For CSS classes/variants.
- **kebab-case**: For API and route filenames.

### Commits & Branching

We adhere to trunk-based development best practices, which include using short-lived branches for code that will be reviewed prior to being merged into the main branch and wrapping new feature functionality in feature flags.

When working on a new task, create a branch off of the 'source-of-truth' branch of your project's repo. For this project, that is the `main` branch. Keep your branch in close parity with the 'source-of-truth' branch to stay up-to-date with the latest changes and avoid merge conflicts.

#### Feature Flags

When working on an in-progress feature, be sure to hide it behind a feature flag until its completion. This ensures we do not show unfinished work in our production deployment.

### Testing

Add unit tests for any new features or bug fixes to maintain code quality. Ensure that all functionality behaves as expected through thorough manual testing.

### Documentation

If your contribution affects the documentation, please update it accordingly. This could include changes to the README, ADL documentation, or any other relevant files. Most pull requests will also require an update to the CHANGELOG to facilitate the preparation of Release Notes.

If you notice any areas where the documentation can be enhanced, please feel free to make those changes. This can include fixing typos, clarifying existing content, or adding new sections.

### Pull Requests

To facilitate quicker and more effective reviews, please follow our [pull request template](.github/PULL_REQUEST_TEMPLATE.md). Please aim to complete as many applicable items in the provided checklist as possible.

#### Updating the CHANGELOG

We keep a `CHANGELOG.md` file in the repository and follow [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) for formatting and guiding principles. When adding to the CHANGELOG, in the sensible section under `[Unreleased]`, add an entry which describes at a high level what is being worked on. Add a link to your PR next to the entry. For example:

```txt
[Unreleased]

### Added

- Feature/Functionality for Foo [#000](https://github.com/path-to-repository/pull/000)
```

If an entry already exists which your PR relates to, simply add a link to your PR next to it:

```txt
- Feature/Functionality for Foo [#000](https://github.com/path-to-repository/pull/000), [#001](https://github.com/path-to-repository/pull/001)
```

When tracking a PR that is a part of Feature Flag related work, add the prefix `[FEATURE FLAGGED]` to the entry:

```txt
[Unreleased]

### Added

- [FEATURE FLAGGED] Feature UI [#011](https://github.com/path-to-repository/pull/011)
```

If your PR removes a Feature Flag, add it next to the entry and remove the `[FEATURE FLAGGED]` prefix.

#### Updating the SBOM

If you update the project's dependencies in any way, the SBOM must be regenerated. See the [bom/README file](bom/README.md) for instructions on how to generate a new SBOM.

## Code of Conduct

We expect all contributors to act professionally and respectfully towards others. If you encounter any behavior that is generally unacceptable or makes you uncomfortable, please report it to the project maintainers. We are committed to maintaining a welcoming and inclusive environment for everyone.

## Acknowledgments

We appreciate your interest in contributing to our project. Thank you for helping us improve and grow!
