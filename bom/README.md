# Software Bill of Materials (SBOM)

This directory contains the project's **Software Bill of Materials (SBOM)**, generated using the [CycloneDX specification](https://cyclonedx.org/).

## What's an SBOM?

An SBOM is a comprehensive inventory of all software components and dependencies used in this project. It enhances transparency, facilitates vulnerability tracking, and helps manage software composition effectively, contributing significantly to overall project security.

## How to Generate the SBOM

The SBOM for this project is generated using the npm package, [cyclonedx-npm](https://www.npmjs.com/package/@cyclonedx/cyclonedx-npm). If you do not have this package installed, you can install it globally using npm:

```bash
npm install --global @cyclonedx/cyclonedx-npm
```

With the CLI installed, you can generate an SBOM by running the following command within the root directory of the project (PALM).

**Note:** This command is specifically tailored for a `yarn`-managed project and will bypass certain npm compatibility issues

```bash
cyclonedx-npm --output-file bom/bom.json --validate --ignore-npm-errors
```

## When to regenerate?

Regenerate the SBOM whenever dependencies are updated, added, or removed, ensuring accuracy and up-to-date security information.
