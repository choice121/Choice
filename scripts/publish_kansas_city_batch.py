#!/usr/bin/env python3
"""Deprecated one-off publisher; use the authenticated pipeline publisher UI."""


def main():
    raise SystemExit(
        "This legacy batch publisher is disabled because it modified listing data, "
        "enabled public listings, and bypassed current publication safeguards. "
        "Use the authenticated pipeline publisher UI."
    )


if __name__ == "__main__":
    main()
