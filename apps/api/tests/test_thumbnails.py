"""Geração de thumbnail WebP (storage.gerar_thumbnail)."""
import io

from PIL import Image

from storage import gerar_thumbnail, THUMB_MAX_WIDTH


def _img_bytes(w: int, h: int, fmt: str = "PNG") -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", (w, h), (120, 30, 200)).save(buf, format=fmt)
    return buf.getvalue()


def test_gera_webp_reduzido():
    original = _img_bytes(1920, 1080, "JPEG")
    thumb = gerar_thumbnail(original)
    assert thumb is not None
    assert len(thumb) < len(original)
    img = Image.open(io.BytesIO(thumb))
    assert img.format == "WEBP"
    assert img.width == THUMB_MAX_WIDTH
    assert img.height == round(1080 * THUMB_MAX_WIDTH / 1920)


def test_imagem_pequena_nao_amplia():
    thumb = gerar_thumbnail(_img_bytes(300, 200))
    assert thumb is not None
    assert Image.open(io.BytesIO(thumb)).size == (300, 200)


def test_png_com_transparencia():
    buf = io.BytesIO()
    Image.new("RGBA", (800, 600), (120, 30, 200, 128)).save(buf, format="PNG")
    thumb = gerar_thumbnail(buf.getvalue())
    assert thumb is not None
    assert Image.open(io.BytesIO(thumb)).format == "WEBP"


def test_conteudo_invalido_retorna_none():
    assert gerar_thumbnail(b"isto nao e uma imagem") is None
