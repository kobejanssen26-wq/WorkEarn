#!/usr/bin/env python3
"""Print the centre ("x y") of the first node in an `adb uiautomator dump` whose text or content-desc matches a label.

    ui_centre.py <ui.xml> <label>

Exact matches win over prefix matches (tab buttons are announced as "Calendar, tab, 2 of 4"). Exit code 1 if nothing matches.
Used by scripts/ci/emulator-smoke.sh to tap the tab bar on a real Android runtime.
"""
import re
import sys
import xml.etree.ElementTree as ET


def centre(node):
    m = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", node.get("bounds", ""))
    if not m:
        return None
    x1, y1, x2, y2 = (int(v) for v in m.groups())
    return f"{(x1 + x2) // 2} {(y1 + y2) // 2}"


def main() -> int:
    path, label = sys.argv[1], sys.argv[2]
    nodes = list(ET.parse(path).getroot().iter("node"))
    for exact in (True, False):
        for node in nodes:
            values = (node.get("text", ""), node.get("content-desc", ""))
            if any((v == label) if exact else v.startswith(label) for v in values):
                found = centre(node)
                if found:
                    print(found)
                    return 0
    return 1


if __name__ == "__main__":
    sys.exit(main())
