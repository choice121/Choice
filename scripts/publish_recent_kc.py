#!/usr/bin/env python3
"""Deprecated one-off publisher; use the authenticated pipeline publisher UI."""


def main():
    raise SystemExit(
        "This legacy publisher is disabled because it rewrote listing data and "
        "bypassed current publication safeguards. Use the authenticated pipeline publisher UI."
    )


if __name__ == "__main__":
    main()
