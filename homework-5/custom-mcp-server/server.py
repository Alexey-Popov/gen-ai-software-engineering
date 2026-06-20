from pathlib import Path

from fastmcp import FastMCP

mcp = FastMCP('lorem-reader')

LOREM_PATH = Path(__file__).parent / 'lorem-ipsum.md'
DEFAULT_WORD_COUNT = 30


def _read_words(word_count: int = DEFAULT_WORD_COUNT) -> str:
    if not LOREM_PATH.exists():
        raise FileNotFoundError(f'Lorem ipsum file not found: {LOREM_PATH}')

    text = LOREM_PATH.read_text(encoding='utf-8')
    words = text.split()
    count = max(0, word_count)
    return ' '.join(words[:count])


@mcp.resource(
    'lorem://text{?word_count}',
    description='Lorem ipsum text from lorem-ipsum.md with optional word limit',
)
def lorem_resource(word_count: int = DEFAULT_WORD_COUNT) -> str:
    return _read_words(word_count)


@mcp.tool()
def read(word_count: int = DEFAULT_WORD_COUNT) -> str:
    """Read lorem ipsum text, limited to word_count words."""
    return _read_words(word_count)


if __name__ == '__main__':
    mcp.run()
