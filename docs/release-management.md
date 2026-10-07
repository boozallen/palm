# PALM Release Management

This document outlines the steps necessary to release a new version of PALM.

## Update CHANGELOG.md

The following changes need to be committed to the [CHANGELOG.md](../CHANGELOG.md) file:

1. Rename "Unreleased" section to "vX.Y.Z - YYYY-MM-DD" where X.Y.Z refers to the new version number and YYYY-MM-DD is the release date. The version number follows the Semantic Versioning strategy, where:
     - X (MAJOR): Incremented for incompatible API changes.
     - Y (MINOR): Incremented when new functionality is added in a backward-compatible manner.
     - Z (PATCH): Incremented for backward-compatible bug fixes.
2. Remove empty subsections under the new release section.
3. Create a new "Unreleased" section above the new release section, with the following empty subsections under it: "Added", "Changed", "Deprecated", "Removed", "Fixed" and "Security".

## Tag Release In GitHub

Create and push an annotated Git tag to the repo for the release.

1. Create the tag locally:

   ```bash
   git tag -a -m "Release vX.Y.Z - YYYY-MM-DD" vX.Y.Z origin/main
   ```
   
   Replacing X.Y.Z and YYYY-MM-DD with the version and release date respectively. Optionally replace origin/main with a different commit or object as necessary.
2. Push the tag:

   ```bash
   git push origin vX.Y.Z
   ```

## Download Build Artifacts

Download the built images from your Docker registry and export to tar files to be attached to the release.

1. Get the commit SHA of the tag:

   ```bash
   git rev-parse vX.Y.Z^{}
   ```
   
   (Output SHA is referred to as COMMIT in following steps)
2. Download the images from your Docker registry:

   ```bash
   docker pull your-docker-registry/palm:COMMIT
   docker pull your-docker-registry/palm-chainguard:COMMIT
   ```
   
3. Export downloaded images to file:

   ```bash
   docker save your-docker-registry/palm:COMMIT | xz > palm-vX.Y.Z.tar.xz
   docker save your-docker-registry/palm-chainguard:COMMIT | xz > palm-chainguard-vX.Y.Z.tar.xz
   ```

## Create Release In GitHub

1. Navigate to your GitHub repository's releases page
2. Click "Draft a new release" button
3. Select your new tag in the "Choose a tag" dropdown
4. Enter "vX.Y.Z - YYYY-MM-DD" as Release title
5. Attach palm-vX.Y.Z.tar.xz and palm-chainguard-vX.Y.Z.tar.xz to the release
6. Click Publish release

## Release Notes

Each version of PALM will be accompanied by release notes detailing the major additions and breaking changes contained in that release. These release notes are available on the PALM GitHub project’s 'Releases' page.

Given the fragile nature of GitHub Release Notes (no version control), we track our in-flight changes in a versioned document within the codebase: [Draft Release Notes](../DRAFT_RELEASE_NOTES.md). This is the workflow:

1. Additions made to the release notes file as we make major modifications to the repo
2. On new release, we add that version of `DRAFT_RELEASE_NOTES.md` to the GitHub release
3. Post-release, `DRAFT_RELEASE_NOTES.md` is reset back to default state
