# Architectural Decision Logs
The substantial architecture decisions made in the PALM application live here.

Records should be stored under the `/docs/adl` directory.

https://adr.github.io/

## ADRs are written in Markdown

The ADRs are written in Markdown. The files are stored in the `/docs/adl` directory.

### Log naming conventions used:
Each log should have the following format `<n>_<decision/topic>.md`.

- The sequence at the start should be padded with zeros to make it 5 digits long, the 10th log would be `00010`.
- An underscore is used between the sequence and decision/topic.
- The decision/topic is in lowercase & kebab-case, the decision of `UI Framwork` becomes `ui-framework`.

## Creating an ADR
A template is provided when new logs need to be created. This template is named `adr-template.md`.

- Copy `docs/adl/adr-template.md` to
  `docs/adl/<n>_<title>.md`
  - `<n>` will be a zero padded, to five places, number. The number you use will be the next one in the sequence of the existing
      ADRs
  - `<title>` with be the kebab-case version of the ADR title
- Fill in the ADR following the guidelines in the template
- Submit a pull request for the new ADR
- Address and integrate feedback from the community
- Merge the pull request once the ADR is *Accepted* or *Rejected*

## Superseding an ADR
When a new ADR supersedes an existing ADR, the new ADR should reference the old ADR and the old ADR should have its status changed to *Superseded*. The new ADR should also be linked to from the old ADR.

## A Permanent Record
The ADRs are a permanent record of the decisions made in the project. They are not deleted or removed. If a decision is no longer relevant, it should be marked as *Deprecated* and the reason for deprecation should be added to the ADR.
