from pathlib import PurePosixPath

import pytest

import design.catalogs
from design.catalogs import (
    CatalogEntry,
    CatalogFileError,
    DeclarationError,
    ParsedCatalog,
    catalog_directory,
    parse_catalog,
)
from design.catalogs.declaration import DEFAULT
from design.catalogs.po_file import read_catalog

PLURAL = 'msgctxt "table.seats"\nmsgid "Platz"\nmsgid_plural "Plätze"\nmsgstr[0] "Seat"\nmsgstr[1] ""\n'


@pytest.mark.parametrize(
    "pyproject_text",
    [
        pytest.param(None, id="no pyproject.toml"),
        pytest.param("", id="empty file"),
        pytest.param('[project]\nname = "app"\n', id="no table"),
        pytest.param('[tool.design-catalogs]\nsource = "en"\n', id="a table without catalogs"),
    ],
)
def test_catalog_directory_is_the_generators_default_where_nothing_declares_one(pyproject_text):
    assert catalog_directory(pyproject_text) == PurePosixPath(DEFAULT.catalogs.as_posix())


@pytest.mark.parametrize(
    ("declared", "directory"),
    [
        pytest.param("locales", "locales", id="plain"),
        pytest.param("web/./locales/", "web/locales", id="normal form"),
    ],
)
def test_catalog_directory_is_the_declared_directory_in_posix_form(declared, directory):
    text = f'[tool.design-catalogs]\ncatalogs = "{declared}"\n'

    assert catalog_directory(text) == PurePosixPath(directory)


@pytest.mark.parametrize(
    ("pyproject_text", "named"),
    [
        pytest.param("[tool.design-catalogs\n", "pyproject.toml is not valid TOML", id="invalid TOML"),
        pytest.param("[tool.design-catalogs]\ncatalogs = 3\n", "catalogs must be a string", id="wrong type"),
        pytest.param('[tool.design-catalogs]\ncatalogs = "../x"\n', "inside the repository", id="outside"),
        pytest.param('[tool.design-catalogs]\nother = "x"\n', "unknown key 'other'", id="unknown key"),
    ],
)
def test_catalog_directory_refuses_a_broken_pyproject_in_one_sentence(pyproject_text, named):
    with pytest.raises(DeclarationError, match=named):
        catalog_directory(pyproject_text)


def test_parse_catalog_returns_the_header_language_and_every_entry_in_file_order():
    content = (
        'msgid ""\nmsgstr ""\n"Language: de\\n"\n\n'
        'msgctxt "a.b"\nmsgid "Eins"\nmsgstr ""\n\n'
        '#, fuzzy\nmsgctxt "a.b"\nmsgid "Eins"\nmsgstr "One"\n\n' + PLURAL + '\nmsgid "Ohne"\nmsgstr "Without"\n'
    ).encode()

    assert parse_catalog(content, "de.po") == ParsedCatalog(
        language="de",
        entries=(
            CatalogEntry("a.b", "Eins", None, ("",), fuzzy=False),
            CatalogEntry("a.b", "Eins", None, ("One",), fuzzy=True),
            CatalogEntry("table.seats", "Platz", "Plätze", ("Seat", ""), fuzzy=False),
            CatalogEntry(None, "Ohne", None, ("Without",), fuzzy=False),
        ),
    )


@pytest.mark.parametrize(
    ("content", "language"),
    [
        pytest.param('msgid ""\nmsgstr ""\n"X-Other: 1\\n"\n', None, id="header without language"),
        pytest.param('msgctxt "a.b"\nmsgid "Eins"\nmsgstr ""\n', None, id="no header"),
        pytest.param('msgid ""\nmsgstr ""\n"Language: pt-BR\\n"\n', "pt-BR", id="header with language"),
    ],
)
def test_parse_catalog_names_no_language_unless_the_header_does(content, language):
    assert parse_catalog(content.encode(), "x.po").language == language


@pytest.mark.parametrize(
    ("msgstr", "forms"),
    [
        pytest.param('msgstr[0] "Seat"\n', ("Seat",), id="one form"),
        pytest.param('msgstr[0] "Seat"\nmsgstr[1] ""\n', ("Seat", ""), id="two forms, the last empty"),
        pytest.param('msgstr[0] ""\nmsgstr[1] "b"\nmsgstr[2] ""\n', ("", "b", ""), id="three forms"),
        pytest.param('msgstr[0] "a"\nmsgstr[1] "b"\nmsgstr[2] "c"\nmsgstr[3] "d"\n', ("a", "b", "c", "d"), id="four"),
    ],
)
def test_parse_catalog_returns_exactly_the_msgstr_forms_the_file_writes(msgstr, forms):
    content = f'msgid "Platz"\nmsgid_plural "Plätze"\n{msgstr}'.encode()

    assert parse_catalog(content, "x.po").entries[0].msgstr == forms


def test_parse_catalog_leaves_out_an_obsolete_entry():
    content = b'msgctxt "a.b"\nmsgid "Eins"\nmsgstr ""\n\n#~ msgctxt "gone.old"\n#~ msgid "x"\n#~ msgstr ""\n'

    assert [entry.msgctxt for entry in parse_catalog(content, "x.po").entries] == ["a.b"]


@pytest.mark.parametrize(
    ("content", "message"),
    [
        pytest.param(b'msgid "Gr\xfc\xdfe"\nmsgstr ""\n', r"^de\.po: the catalog is not valid UTF-8$", id="not UTF-8"),
        pytest.param(b'msgid "a"\nmsgstr "b\n', r"^de\.po:2: the string is not closed by a quote$", id="open string"),
        pytest.param(b'msgid "a"\nbogus "b"\n', r"^de\.po:2: Unknown or misformatted keyword$", id="invalid file"),
    ],
)
def test_parse_catalog_refuses_a_malformed_file_naming_the_file_and_the_line(content, message):
    with pytest.raises(CatalogFileError, match=message):
        parse_catalog(content, "de.po")


@pytest.mark.parametrize(
    ("content", "plural", "msgstr"),
    [
        pytest.param(
            'msgid "a"\nmsgstr[0] ""\nmsgstr[1] "Geheim"\n', None, ("",), id="singular entry with a second msgstr form"
        ),
        pytest.param('msgid "a"\nmsgstr[1] "B"\n', None, ("B",), id="singular entry with only msgstr[1]"),
        pytest.param(
            'msgid "a"\nmsgid_plural "b"\nmsgstr[1] "B"\n', "b", ("", "B"), id="plural entry with only msgstr[1]"
        ),
        pytest.param(
            'msgid "a"\nmsgid_plural "b"\nmsgstr[0] "A"\nmsgstr[2] "C"\n',
            "b",
            ("A", "", "C"),
            id="plural entry with a gap between its msgstr forms",
        ),
    ],
)
def test_parse_catalog_accepts_an_entry_with_unusual_msgstr_forms(content, plural, msgstr):
    entry = parse_catalog(content.encode(), "de.po").entries[0]

    assert (entry.msgid_plural, entry.msgstr) == (plural, msgstr)


def test_parse_catalog_leaves_out_an_obsolete_entry_with_unusual_msgstr_forms():
    content = b'msgid "a"\nmsgstr ""\n\n#~ msgid "b"\n#~ msgstr[0] ""\n#~ msgstr[1] "Geheim"\n'

    assert [entry.msgid for entry in parse_catalog(content, "de.po").entries] == ["a"]


def test_the_generators_path_reading_accepts_a_singular_entry_with_a_second_msgstr_form(tmp_path):
    path = tmp_path / "en.po"
    path.write_text('msgctxt "a.b"\nmsgid "a"\nmsgstr[0] ""\nmsgstr[1] "Geheim"\n', encoding="utf-8")

    (entry,) = read_catalog(path).entries

    assert (entry.translation, entry.plural) == ("", False)


def test_the_package_exports_the_readers_and_their_records_alone():
    assert set(design.catalogs.__all__) == {
        "CatalogEntry",
        "CatalogFileError",
        "DeclarationError",
        "ParsedCatalog",
        "catalog_directory",
        "parse_catalog",
    }


def test_the_package_raises_attribute_error_naming_an_unknown_name():
    with pytest.raises(AttributeError, match="no_such_name"):
        design.catalogs.no_such_name  # noqa: B018 - the attribute access is the call under test
