from dataclasses import dataclass


class DocumentParserError(Exception):
    pass


@dataclass(frozen=True)
class ParsedPage:
    page_number: int
    text: str
    warnings: list[str]


@dataclass(frozen=True)
class ParsedDocument:
    page_count: int
    pages: list[ParsedPage]
    warnings: list[str]


class PyMuPDFDocumentParser:
    name = "pymupdf"

    def parse_pdf(self, content: bytes) -> ParsedDocument:
        try:
            import fitz
        except ImportError as exc:
            raise DocumentParserError("PyMuPDF is not installed.") from exc

        try:
            document = fitz.open(stream=content, filetype="pdf")
        except Exception as exc:
            raise DocumentParserError("PDF could not be opened.") from exc

        pages: list[ParsedPage] = []
        warnings: list[str] = []
        try:
            for index, page in enumerate(document, start=1):
                text = page.get_text("text").strip()
                page_warnings: list[str] = []
                if not text:
                    warning = f"Page {index} has no extractable text."
                    page_warnings.append(warning)
                    warnings.append(warning)
                pages.append(ParsedPage(page_number=index, text=text, warnings=page_warnings))
            return ParsedDocument(page_count=document.page_count, pages=pages, warnings=warnings)
        finally:
            document.close()


def get_document_parser() -> PyMuPDFDocumentParser:
    return PyMuPDFDocumentParser()
