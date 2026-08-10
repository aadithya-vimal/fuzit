# Schema compatibility

| Schema           | Current | Compatibility policy                                |
| ---------------- | ------: | --------------------------------------------------- |
| Context bundle   |       1 | Readers reject unknown major schema versions.       |
| Selection report |       1 | Readers reject unknown major schema versions.       |
| Local index      |       1 | Rebuild the local index after an incompatible bump. |

Every schema bump requires a changeset plus either migration instructions or an
explicit rebuild note. Local indexes contain derived data and may be safely
removed and rebuilt with the next scan.
