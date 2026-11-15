"""The kit's catalogs: the `design-catalogs` command and two pure functions that read what it reads.

`parse_catalog` and `CatalogFileError` need Babel, which the extra `po` installs; the extra `catalogs`, for adopters
of the generator, requires `po`. They load on first use, so that importing the package, and the command's own message
about the missing extra, needs none.
"""

from typing import TYPE_CHECKING

from design.catalogs.catalog import CatalogEntry, ParsedCatalog
from design.catalogs.declaration import DeclarationError, catalog_directory

if TYPE_CHECKING:
    from design.catalogs.po_file import CatalogFileError, parse_catalog

__all__ = [
    "CatalogEntry",
    "CatalogFileError",
    "DeclarationError",
    "ParsedCatalog",
    "catalog_directory",
    "parse_catalog",
]

_NEEDS_BABEL = frozenset({"CatalogFileError", "parse_catalog"})


def __getattr__(name: str) -> object:
    if name not in _NEEDS_BABEL:
        raise AttributeError(f"module {__name__!r} has no attribute {name!r}")
    from design.catalogs import po_file

    return getattr(po_file, name)
