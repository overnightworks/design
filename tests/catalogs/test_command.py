import pytest

from design.catalogs.command import main
from design.catalogs.declaration import DEFAULT

SOURCE_LANGUAGE = DEFAULT.source.value


@pytest.fixture
def module_path(module_for):
    return module_for(SOURCE_LANGUAGE)


@pytest.fixture
def clean_source(write_source, catalog_text, block):
    return write_source(catalog_text(block("table.seatFree", "Frei"), block("app.name", "Skat")))


@pytest.fixture
def clean_translation(clean_source, write_catalog, catalog_text, block):
    """The Polish translation of `clean_source`, current."""
    return write_catalog(
        "pl",
        catalog_text(block("table.seatFree", "Frei", "Wolne"), block("app.name", "Skat", "Skat (pl)"), language="pl"),
    )


@pytest.fixture
def python_module(project, declare):
    """The declared Python module of the clean catalogs."""
    declare(python="src/app/words.py")
    return project / "src/app/words.py"


@pytest.fixture(params=[SOURCE_LANGUAGE, "pl", "index", "python"])
def generated_module(request, clean_translation, python_module, module_for):
    """Each module the command writes for the clean catalogs: a language's, the loader and the Python module."""
    return python_module if request.param == "python" else module_for(request.param)


def test_main_writes_the_typed_source_module_from_the_source_catalog(clean_source, module_path):
    assert main([]) == 0

    written = module_path.read_text(encoding="utf-8")
    assert 'export const language = "de";' in written
    assert '    "table.seatFree": "Frei",' in written


def test_main_run_again_gives_the_same_bytes(generated_module):
    main([])
    first = generated_module.read_bytes()

    assert main([]) == 0
    assert generated_module.read_bytes() == first


def test_main_check_passes_on_a_current_module_and_writes_nothing(generated_module):
    main([])
    before = generated_module.stat().st_mtime_ns

    assert main(["--check"]) == 0
    assert generated_module.stat().st_mtime_ns == before


@pytest.mark.parametrize(
    ("content", "sentence"),
    [(None, "the module is missing"), ("edited by hand\n", "the module differs from its catalog")],
    ids=["missing", "differing"],
)
def test_main_check_fails_naming_a_missing_or_differing_module_and_writes_nothing(
    generated_module, capsys, content, sentence
):
    main([])
    if content is None:
        generated_module.unlink()
    else:
        generated_module.write_text(content, encoding="utf-8")

    assert main(["--check"]) == 1

    error = capsys.readouterr().err
    assert f"{generated_module.name}: {sentence}; run design-catalogs" in error
    assert (generated_module.read_text(encoding="utf-8") if generated_module.exists() else None) == content


def test_main_check_fails_naming_a_file_in_the_module_directory_that_no_catalog_produces(
    clean_translation, module_for, capsys
):
    main([])
    stray = module_for("xx")
    stray.write_text("// left over\n", encoding="utf-8")

    assert main(["--check"]) == 1

    assert stray.name in capsys.readouterr().err


@pytest.mark.parametrize("name", [".gitkeep", ".DS_Store"])
def test_main_check_does_not_count_a_dotfile_in_the_module_directory_as_a_stray(clean_translation, module_for, name):
    main([])
    (module_for("xx").parent / name).write_text("", encoding="utf-8")

    assert main(["--check"]) == 0


def test_main_without_check_leaves_a_file_no_catalog_produces_alone(clean_translation, module_for):
    stray = module_for("xx")
    stray.parent.mkdir(parents=True)
    stray.write_text("// left over\n", encoding="utf-8")

    assert main([]) == 0
    assert stray.read_text(encoding="utf-8") == "// left over\n"


@pytest.mark.parametrize("arguments", [[], ["--check"]])
def test_main_fails_naming_file_and_key_of_a_broken_source_entry_and_writes_nothing(
    write_source, catalog_text, block, module_path, capsys, arguments
):
    write_source(catalog_text(block("seat_free", "Frei")))

    assert main(arguments) == 1

    error = capsys.readouterr().err
    assert "de.po" in error
    assert "seat_free" in error
    assert not module_path.exists()


def test_main_fails_naming_the_source_catalog_and_the_declaration_key_when_it_is_missing(project, source_path, capsys):
    assert main([]) == 1

    error = capsys.readouterr().err
    assert "de.po" in error
    assert "tool.design-catalogs source" in error


@pytest.mark.parametrize("arguments", [[], ["--check"]])
def test_main_fails_naming_file_and_line_of_a_malformed_catalog_and_writes_nothing(
    write_source, catalog_text, block, module_path, capsys, arguments
):
    write_source(catalog_text(block("table.seatFree", "Frei"), 'msgctxt "app.name"\nmsgid "Skat\nmsgstr ""\n'))

    assert main(arguments) == 1

    output = capsys.readouterr()
    assert output.out == ""
    assert "de.po:11" in output.err
    assert not module_path.exists()


@pytest.mark.parametrize("arguments", [[], ["--check"]])
def test_main_fails_naming_file_and_key_of_a_broken_translation_and_writes_nothing(
    clean_source, write_catalog, catalog_text, block, module_for, capsys, arguments
):
    write_catalog("pl", catalog_text(block("table.seatFree", "Frei", "Wolne"), language="pl"))

    assert main(arguments) == 1

    error = capsys.readouterr().err
    assert "pl.po" in error
    assert "app.name" in error
    assert not module_for("pl").exists()
    assert not module_for(SOURCE_LANGUAGE).exists()


def test_main_fails_naming_a_catalog_whose_file_name_is_no_language_tag(
    clean_source, write_catalog, catalog_text, block, capsys
):
    write_catalog("pl_PL", catalog_text(block("table.seatFree", "Frei", "Wolne"), language="pl_PL"))

    assert main([]) == 1

    assert "pl_PL.po" in capsys.readouterr().err


def test_main_help_says_the_command_writes_one_module_per_language_and_runs_after_the_translations_are_written(capsys):
    with pytest.raises(SystemExit) as stopped:
        main(["--help"])

    assert stopped.value.code == 0
    help_text = " ".join(capsys.readouterr().out.split())
    assert "per language" in help_text
    assert "--sync" in help_text
    assert "after the translations are written" in help_text


@pytest.mark.parametrize("language", [SOURCE_LANGUAGE, "pl"])
def test_main_fails_naming_a_catalog_that_is_not_utf8_without_a_traceback(
    clean_translation, write_catalog, module_for, capsys, language
):
    write_catalog(language, b'msgctxt "app.name"\nmsgid "Gr\xfc\xdfe"\nmsgstr ""\n')

    assert main([]) == 1

    assert f"{language}.po" in capsys.readouterr().err
    assert not module_for(language).exists()


def test_main_writes_the_translation_typed_by_the_source_and_the_loader_of_the_languages_the_catalogs_name(
    clean_translation, module_for
):
    assert main([]) == 0

    translation = module_for("pl").read_text(encoding="utf-8")
    assert 'import type { Words } from "./de.js";' in translation
    assert '    "table.seatFree": "Wolne",' in translation
    assert 'export const languages = ["de", "pl"] as const;' in module_for("index").read_text(encoding="utf-8")


def test_main_writes_the_python_module_of_every_language_where_the_declaration_names_one(
    clean_translation, python_module, import_module
):
    assert main([]) == 0

    words = import_module(python_module)
    assert words.LANGUAGES == (SOURCE_LANGUAGE, "pl")
    assert words.text(SOURCE_LANGUAGE, "table.seatFree") == "Frei"
    assert words.text("pl", "table.seatFree") == "Wolne"


def test_main_writes_no_python_module_where_the_declaration_names_none(clean_translation, project):
    assert main([]) == 0

    assert not list(project.rglob("*.py"))


def test_main_reads_and_writes_the_paths_of_the_declaration(project, declare, catalog_text, block):
    declare(source="en", catalogs="locales", typescript="web/words")
    (project / "locales").mkdir()
    (project / "locales" / "en.po").write_text(catalog_text(block("app.name", "Skat"), language="en"), encoding="utf-8")

    assert main([]) == 0
    assert 'export const language = "en";' in (project / "web/words/en.ts").read_text(encoding="utf-8")
    assert main(["--check"]) == 0


@pytest.mark.parametrize("arguments", [[], ["--check"]])
def test_main_refuses_a_python_module_over_a_catalog_and_leaves_the_catalog_as_it_was(
    clean_source, declare, project, capsys, arguments
):
    declare(python=clean_source.relative_to(project).as_posix())
    before = clean_source.read_bytes()

    assert main(arguments) == 1

    error = capsys.readouterr().err
    assert "tool.design-catalogs" in error
    assert "python" in error
    assert clean_source.read_bytes() == before


SEATS_SOURCE = (("table.seats.one", "{count} Platz"), ("table.seats.other", "{count} Plätze"))


@pytest.fixture
def seats_source(write_source, catalog_text, block):
    """A source catalog holding the plural family `table.seats` in the categories of German."""
    return write_source(catalog_text(*(block(key, text) for key, text in SEATS_SOURCE)))


def polish_seats(*categories):
    """The blocks of the Polish family: each category in `categories` translated from the source text it falls to."""
    return [
        (
            f"table.seats.{category}",
            SEATS_SOURCE[0][1] if category == "one" else SEATS_SOURCE[1][1],
            f"{category} {{count}}",
        )
        for category in categories
    ]


def test_main_takes_catalogs_without_babel_rules_where_no_family_needs_them(
    write_catalog, catalog_text, block, declare, module_for
):
    declare(source="tlh")
    write_catalog("tlh", catalog_text(block("table.seatFree", "Frei"), language="tlh"))
    write_catalog("xx", catalog_text(block("table.seatFree", "Frei", "Wolne"), language="xx"))

    assert main([]) == 0
    assert main(["--check"]) == 0
    assert module_for("xx").is_file()


def test_main_writes_a_python_module_that_chooses_the_family_sentence_by_the_count_and_checks_it(
    seats_source, write_catalog, catalog_text, block, python_module, import_module, capsys
):
    write_catalog(
        "pl", catalog_text(*(block(*entry) for entry in polish_seats("one", "few", "many", "other")), language="pl")
    )

    assert main([]) == 0
    assert main(["--check"]) == 0

    module = import_module(python_module)
    assert [module.text("pl", "table.seats", count=count) for count in (1, 2, 5)] == ["one 1", "few 2", "many 5"]
    assert module.text("de", "table.seats", count=1) == "1 Platz"
    assert capsys.readouterr().err == ""


@pytest.fixture
def stale_translation(write_source, write_catalog, catalog_text, block):
    """A source whose `table.seatFree` changed and that gained `chat.new` and dropped `table.gone`, and the Polish
    translation from before."""
    write_source(
        catalog_text(block("table.seatFree", "Frei und mehr"), block("app.name", "Skat"), block("chat.new", "Neu"))
    )
    return write_catalog(
        "pl",
        catalog_text(
            block("table.seatFree", "Frei", "Wolne"),
            block("app.name", "Skat", "Skat (pl)"),
            block("table.gone", "Weg", "Zniknęło"),
            language="pl",
        ),
    )


def test_main_sync_brings_a_translation_in_line_with_its_source_by_key(stale_translation, capsys):
    assert main(["--sync"]) == 0

    written = stale_translation.read_text(encoding="utf-8")
    assert '#, fuzzy\nmsgctxt "table.seatFree"\nmsgid "Frei und mehr"\nmsgstr "Wolne"\n' in written
    assert 'msgctxt "app.name"\nmsgid "Skat"\nmsgstr "Skat (pl)"\n' in written
    assert 'msgctxt "chat.new"\nmsgid "Neu"\nmsgstr ""\n' in written
    assert "table.gone" not in written
    assert capsys.readouterr().err == ""


def test_main_sync_run_again_changes_no_byte(stale_translation):
    main(["--sync"])
    first = stale_translation.read_bytes()
    before = stale_translation.stat().st_mtime_ns

    assert main(["--sync"]) == 0
    assert stale_translation.read_bytes() == first
    assert stale_translation.stat().st_mtime_ns == before


def test_main_sync_writes_catalogs_only(stale_translation, module_for):
    assert main(["--sync"]) == 0

    assert not module_for(SOURCE_LANGUAGE).exists()
    assert not module_for("pl").exists()


def test_main_check_fails_on_a_synced_catalog_until_the_translations_are_written_and_the_marks_cleared(
    stale_translation, write_catalog, catalog_text, block, capsys
):
    main(["--sync"])

    assert main(["--check"]) == 1

    error = capsys.readouterr().err
    assert "table.seatFree is fuzzy" in error
    assert "chat.new has an empty msgstr" in error
    write_catalog(
        "pl",
        catalog_text(
            block("table.seatFree", "Frei und mehr", "Wolne i wiecej"),
            block("app.name", "Skat", "Skat (pl)"),
            block("chat.new", "Neu", "Nowe"),
            language="pl",
        ),
    )
    assert main([]) == 0
    assert main(["--check"]) == 0


def test_main_sync_refuses_to_run_with_check_and_writes_nothing(stale_translation):
    before = stale_translation.read_bytes()

    with pytest.raises(SystemExit) as stopped:
        main(["--sync", "--check"])

    assert stopped.value.code == 2
    assert stale_translation.read_bytes() == before


@pytest.mark.parametrize(
    ("damage", "named"),
    [
        pytest.param('msgctxt "app.name"\nmsgid "Skat\nmsgstr ""\n', "de.po:", id="broken source entry"),
        pytest.param("", "de.po", id="missing source"),
    ],
)
def test_main_sync_refuses_a_broken_source_and_writes_nothing(stale_translation, source_path, capsys, damage, named):
    before = stale_translation.read_bytes()
    if damage:
        source_path.write_text(source_path.read_text(encoding="utf-8") + damage, encoding="utf-8")
    else:
        source_path.unlink()

    assert main(["--sync"]) == 1

    assert named in capsys.readouterr().err
    assert stale_translation.read_bytes() == before


def test_main_sync_refuses_a_translation_it_cannot_follow_and_writes_no_catalog(
    stale_translation, write_catalog, catalog_text, block, capsys
):
    broken = write_catalog(
        "en", catalog_text(block("app.name", "Skat", "a"), block("app.name", "Skat", "b"), language="en")
    )
    before = (stale_translation.read_bytes(), broken.read_bytes())

    assert main(["--sync"]) == 1

    error = capsys.readouterr().err
    assert "en.po" in error
    assert "app.name is a duplicate" in error
    assert before == (stale_translation.read_bytes(), broken.read_bytes())
