# Ignore precedence

Path decisions use canonical repository-relative paths. Precedence is highest
to lowest:

1. hard exclusions;
2. CLI include/exclude rules;
3. project configuration rules;
4. `.fuzitignore`;
5. `.gitignore`;
6. built-in defaults.

Hard exclusions are absolute. A higher non-hard layer may include or exclude a
path affected by a lower layer. Within one layer, the last matching rule wins.
Every decision retains the winning layer, rule, reason, and shadowed matches.
