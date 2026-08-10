# Symlink safety

Scanner traversal reports symbolic links as metadata and does not follow them
by default. Explicit follow requests resolve the target canonically and permit
it only when it remains inside the selected repository root.

Broken links, loops, and outside-root targets remain unfollowed with an
explicit status. Directory junctions use the same boundary rule. There is no
unsafe follow override in the local CLI baseline.

Canonical targets are revalidated at each operation boundary, so a link swap
or root replacement cannot reuse an earlier authorization. Locked reads and
uncertain races fail closed with bounded partial results. Unicode lookalikes
remain inert path text, case-distinct names keep distinct identities, and
cache or output paths must remain within their approved root.
