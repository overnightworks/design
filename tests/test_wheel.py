import configparser
import email
import functools
import hashlib
import http.server
import json
import re
import subprocess
import sys
import threading
import tomllib
import zipfile
from pathlib import Path

import pytest

from design.catalogs.command import MISSING_EXTRA
from design.catalogs.po_file import read_catalog

REPOSITORY = Path(__file__).resolve().parent.parent


@pytest.fixture(scope="module")
def installed_package(tmp_path_factory):
    """The package as a consumer gets it: built into a wheel, unpacked, imported from there."""
    root = tmp_path_factory.mktemp("wheel")
    subprocess.run(
        ["uv", "build", "--wheel", "--out-dir", str(root), str(REPOSITORY)],
        check=True,
        capture_output=True,
    )
    (wheel,) = root.glob("*.whl")
    unpacked = root / "site"
    zipfile.ZipFile(wheel).extractall(unpacked)
    probe = (
        "import sys; sys.path.insert(0, sys.argv[1]);"
        "from importlib.resources import files;"
        "print(files('design') / 'static')"
    )
    static = subprocess.run(
        [sys.executable, "-I", "-c", probe, str(unpacked)],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.strip()
    return wheel, Path(static)


def test_wheel_top_level_is_the_design_package_and_its_dist_info(installed_package):
    wheel, _ = installed_package
    top_level = {name.split("/")[0] for name in zipfile.ZipFile(wheel).namelist()}
    assert top_level == {"design", f"{wheel.name.split('-py3')[0]}.dist-info"}


def test_design_resolves_inside_the_unpacked_wheel(installed_package):
    wheel, static = installed_package
    assert static.is_relative_to(wheel.parent / "site")


def test_wheel_holds_the_stylesheet_the_fonts_and_both_licences(installed_package, font_files, licences):
    _, static = installed_package
    assert (static / "design.css").is_file()
    assert {path.name for path in (static / "fonts").iterdir()} == font_files | licences


def test_wheel_stylesheet_is_byte_equal_to_the_source_stylesheet(installed_package):
    _, static = installed_package
    source = REPOSITORY / "src" / "design" / "static" / "design.css"
    assert (static / "design.css").read_bytes() == source.read_bytes()


def test_wheel_holds_only_data_and_no_tests(installed_package):
    wheel, _ = installed_package
    names = zipfile.ZipFile(wheel).namelist()
    assert not [name for name in names if name.startswith("tests")]
    assert not [name for name in names if name.endswith((".po", ".pot"))]


def test_wheel_holds_no_svelte_component_and_no_component_build(installed_package):
    wheel, _ = installed_package
    names = zipfile.ZipFile(wheel).namelist()
    assert not [name for name in names if name.endswith(".svelte") or "svelte-dist" in name]


def test_every_url_in_the_stylesheet_names_a_font_in_the_wheel(installed_package, font_files, stylesheet_urls):
    _, static = installed_package
    urls = stylesheet_urls(static / "design.css")
    assert len(urls) == len(font_files)
    for url in urls:
        assert (static / url).is_file(), url


def top_level_rules(stylesheet):
    """Selector to body of each top-level rule; raises when braces do not balance."""
    rules, depth, selector_start, body_start, selector = {}, 0, 0, 0, ""
    for index, character in enumerate(stylesheet):
        if character == "{":
            if depth == 0:
                selector = " ".join(stylesheet[selector_start:index].split())
                body_start = index + 1
            depth += 1
        elif character == "}":
            depth -= 1
            assert depth >= 0, "closing brace without opening brace"
            if depth == 0:
                rules.setdefault(selector, []).append(stylesheet[body_start:index])
                selector_start = index + 1
    assert depth == 0, "unclosed rule"
    return rules


LIGHT_SELECTOR = ":root"
DARK_SELECTOR = "[data-theme='dark']"


def body_of(rules, selector):
    """Body of the one top-level rule whose selector list names the selector."""
    (body,) = [
        body
        for selectors, bodies in rules.items()
        for member in [part.strip() for part in selectors.split(",")]
        if member == selector
        for body in bodies
    ]
    return body


def test_light_is_the_no_choice_case_and_dark_follows_the_device_or_the_attribute(installed_package):
    _, static = installed_package
    rules = top_level_rules((static / "design.css").read_text())
    (device_dark,) = rules["@media (prefers-color-scheme: dark)"]
    assert ":root:not([data-theme='light'])" in device_dark
    bodies = {
        ("light", "no attribute"): body_of(rules, LIGHT_SELECTOR),
        ("dark", "attribute"): body_of(rules, DARK_SELECTOR),
        ("dark", "device"): device_dark,
    }
    for (scheme, case), body in bodies.items():
        assert re.search(r"^\s+--bg:", body, re.MULTILINE), case
        assert re.search(rf"^\s+color-scheme: {scheme};", body, re.MULTILINE), case


def test_the_page_root_keeps_the_specificity_of_a_root_with_the_dark_attribute(installed_package):
    _, static = installed_package
    rules = top_level_rules((static / "design.css").read_text())
    (selectors,) = [selectors for selectors, bodies in rules.items() if body_of(rules, DARK_SELECTOR) in bodies]
    members = {part.strip() for part in selectors.split(",")}
    assert ":root[data-theme='dark']" in members


COLOUR = re.compile(r"#[0-9a-f]{3,8}|rgba?\([0-9., ]+\)")


def declarations(body):
    """Custom property and color-scheme declarations of a rule body, name to value."""
    return dict(re.findall(r"^\s+(--[a-z0-9-]+|color-scheme):\s*(.+?);$", body, re.MULTILINE))


@pytest.fixture
def scheme_declarations(installed_package):
    _, static = installed_package
    rules = top_level_rules((static / "design.css").read_text())
    (device_dark,) = rules["@media (prefers-color-scheme: dark)"]
    return {
        "light": declarations(body_of(rules, LIGHT_SELECTOR)),
        "dark attribute": declarations(body_of(rules, DARK_SELECTOR)),
        "dark device": declarations(device_dark.split("{", 1)[1].rsplit("}", 1)[0]),
    }


def test_token_list_holds_exactly_the_properties_the_stylesheet_defines(installed_package, scheme_declarations):
    _, static = installed_package
    listing = subprocess.run(
        [str(REPOSITORY / "scripts" / "list_tokens"), str(static / "design.css")],
        check=True,
        capture_output=True,
        text=True,
    ).stdout.split()
    defined = {name for declared in scheme_declarations.values() for name in declared if name.startswith("--")}
    assert listing == sorted(defined)


def test_every_colour_token_of_light_is_defined_in_both_dark_blocks_as_a_colour(scheme_declarations):
    light = scheme_declarations["light"]
    colour_tokens = {name for name, value in light.items() if COLOUR.fullmatch(value)}
    assert colour_tokens
    for case in ("dark attribute", "dark device"):
        assert colour_tokens <= scheme_declarations[case].keys(), case
        for name in colour_tokens:
            assert COLOUR.fullmatch(scheme_declarations[case][name]), (case, name)


def test_the_tokens_dark_does_not_redefine_are_no_colours(scheme_declarations):
    light = scheme_declarations["light"]
    for case in ("dark attribute", "dark device"):
        for name in light.keys() - scheme_declarations[case].keys():
            assert not COLOUR.fullmatch(light[name]), (case, name)


def test_both_dark_blocks_define_the_same_values_in_full(scheme_declarations):
    assert scheme_declarations["dark attribute"] == scheme_declarations["dark device"]


def test_wheel_installs_the_declared_commands_and_offers_the_declared_extras(installed_package):
    wheel, _ = installed_package
    archive = zipfile.ZipFile(wheel)
    (entry_points_name,) = [name for name in archive.namelist() if name.endswith(".dist-info/entry_points.txt")]
    (metadata_name,) = [name for name in archive.namelist() if name.endswith(".dist-info/METADATA")]
    entry_points = configparser.ConfigParser()
    entry_points.read_string(archive.read(entry_points_name).decode())
    metadata = email.message_from_string(archive.read(metadata_name).decode())
    declared = tomllib.loads((REPOSITORY / "pyproject.toml").read_text())["project"]

    assert dict(entry_points["console_scripts"]) == declared["scripts"]
    assert sorted(metadata.get_all("Provides-Extra")) == sorted(declared["optional-dependencies"])
    shipped = metadata.get_all("Requires-Dist")
    for extra, requirements in declared["optional-dependencies"].items():
        for requirement in requirements:
            name = re.match(r"[A-Za-z0-9_.-]+", requirement)[0].lower()
            assert any(
                line.lower().startswith(name) and re.search(rf"extra == ['\"]{extra}['\"]", line) for line in shipped
            ), (extra, requirement)
    assert len(shipped) == len(declared["dependencies"]) + sum(
        len(requirements) for requirements in declared["optional-dependencies"].values()
    )


@pytest.fixture
def run_declared_command(installed_package, tmp_path):
    """Runs the declared console script from the unpacked wheel in an empty project; only the wheel is importable."""
    wheel, _ = installed_package
    module, function = tomllib.loads((REPOSITORY / "pyproject.toml").read_text())["project"]["scripts"][
        "design-catalogs"
    ].split(":")
    probe = (
        "import importlib, sys; sys.path[:0] = sys.argv[1:];"
        f"sys.exit(getattr(importlib.import_module({module!r}), {function!r})([]))"
    )

    def run(*extra_path: Path) -> subprocess.CompletedProcess[str]:
        # -S keeps the environment's site-packages, and so Babel, out of the import path
        return subprocess.run(
            [sys.executable, "-I", "-S", "-c", probe, str(wheel.parent / "site"), *map(str, extra_path)],
            cwd=tmp_path,
            capture_output=True,
            text=True,
            check=False,
        )

    return run


def test_declared_command_without_babel_fails_with_a_sentence_naming_the_extra(run_declared_command):
    result = run_declared_command()

    assert result.returncode != 0
    assert MISSING_EXTRA in result.stderr


def test_declared_command_does_not_call_a_broken_babel_a_missing_extra(run_declared_command, tmp_path):
    broken = tmp_path / "broken"
    (broken / "babel").mkdir(parents=True)
    (broken / "babel" / "__init__.py").write_text("import a_dependency_babel_needs\n")

    result = run_declared_command(broken)

    assert result.returncode != 0
    assert "a_dependency_babel_needs" in result.stderr
    assert MISSING_EXTRA not in result.stderr


def test_wheel_holds_every_module_of_the_catalogs_package(installed_package):
    wheel, _ = installed_package
    names = set(zipfile.ZipFile(wheel).namelist())
    modules = {path.name for path in (REPOSITORY / "src" / "design" / "catalogs").glob("*.py")}
    assert modules
    assert {f"design/catalogs/{name}" for name in modules} <= names


def test_wheel_holds_the_kit_words_module(installed_package):
    wheel, _ = installed_package
    assert "design/words.py" in zipfile.ZipFile(wheel).namelist()


@pytest.fixture
def kit_words_probe(installed_package, tmp_path):
    """Runs a snippet against the wheel's `design.words` alone; -S keeps Babel out of the import path."""
    wheel, _ = installed_package

    def run(snippet: str) -> subprocess.CompletedProcess[str]:
        probe = f"import json, sys; sys.path.insert(0, sys.argv[1]); from design import words; {snippet}"
        return subprocess.run(
            [sys.executable, "-I", "-S", "-c", probe, str(wheel.parent / "site")],
            cwd=tmp_path,
            capture_output=True,
            text=True,
            check=False,
        )

    return run


def test_kit_words_import_without_the_catalogs_extra_and_list_the_catalogs_languages(kit_words_probe):
    result = kit_words_probe("print(json.dumps(sorted(words.LANGUAGES)))")

    assert result.returncode == 0, result.stderr
    assert json.loads(result.stdout) == sorted(path.stem for path in (REPOSITORY / "src" / "catalogs").glob("*.po"))


@pytest.mark.parametrize("key", ["account.logOut", "legalLinks.name"])
def test_kit_words_give_the_german_text_of_a_key(kit_words_probe, key):
    german = next(
        entry.text for entry in read_catalog(REPOSITORY / "src" / "catalogs" / "de.po").entries if entry.context == key
    )

    result = kit_words_probe(f"print(words.text('de', '{key}'))")

    assert result.returncode == 0, result.stderr
    assert result.stdout.strip() == german


def test_kit_words_refuse_an_unknown_key(kit_words_probe):
    result = kit_words_probe("words.text('de', 'account.noSuchWord')")

    assert result.returncode != 0
    assert "KeyError" in result.stderr
    assert "account.noSuchWord" in result.stderr


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):  # noqa: A002 - the base class's parameter name
        """Serves without writing a line per request."""


@pytest.fixture
def wheel_url(installed_package):
    """The built wheel on a local HTTP server, where a consumer's pin points to a release asset."""
    wheel, _ = installed_package
    handler = functools.partial(QuietHandler, directory=wheel.parent)
    with http.server.ThreadingHTTPServer(("127.0.0.1", 0), handler) as server:
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        yield f"http://127.0.0.1:{server.server_port}/{wheel.name}"
        server.shutdown()
        thread.join()


@pytest.fixture
def install_pinned(installed_package, wheel_url, tmp_path):
    """Installs the wheel the way an app pins it: by URL with a `#sha256=` fragment."""
    wheel, _ = installed_package

    def install(sha256):
        return subprocess.run(
            [
                "uv",
                "pip",
                "install",
                "--cache-dir",
                str(tmp_path / "cache"),
                "--target",
                str(tmp_path / "site"),
                f"overnightworks-design @ {wheel_url}#sha256={sha256}",
            ],
            capture_output=True,
            text=True,
            check=False,
        )

    return install, hashlib.sha256(wheel.read_bytes()).hexdigest()


def test_install_by_url_with_the_wheels_hash_succeeds(install_pinned):
    install, wheel_hash = install_pinned

    result = install(wheel_hash)

    assert result.returncode == 0, result.stderr


def test_install_by_url_with_another_hash_fails_naming_both_hashes(install_pinned):
    install, wheel_hash = install_pinned
    wrong_hash = "0" * 64

    result = install(wrong_hash)

    assert result.returncode != 0
    assert wrong_hash in result.stderr
    assert wheel_hash in result.stderr
