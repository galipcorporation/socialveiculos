import asyncio
import io
import os
import re
import unicodedata
import uuid
import boto3
from botocore.exceptions import ClientError

from config import settings


# Assinaturas de arquivo (magic bytes). O Content-Type do multipart é escolhido
# pelo cliente e não prova nada — um HTML com <script> renomeado para .pdf chega
# como "application/pdf" e passa por qualquer whitelist de MIME. Aqui olhamos os
# bytes reais antes de gravar, para que o tipo declarado seja o tipo de fato.
def _casa_webp(c: bytes) -> bool:
    return c[:4] == b"RIFF" and c[8:12] == b"WEBP"


def _casa_heic(c: bytes) -> bool:
    # ISO-BMFF: bytes 4..8 = "ftyp", seguido da marca (heic/heix/mif1/msf1...).
    return c[4:8] == b"ftyp" and c[8:12] in (
        b"heic", b"heix", b"hevc", b"hevx", b"mif1", b"msf1", b"heim", b"heis",
    )


ASSINATURAS_ARQUIVO = {
    "application/pdf": lambda c: c[:5] == b"%PDF-",
    "image/jpeg": lambda c: c[:3] == b"\xff\xd8\xff",
    "image/png": lambda c: c[:8] == b"\x89PNG\r\n\x1a\n",
    "image/webp": _casa_webp,
    "image/heic": _casa_heic,
    "image/heif": _casa_heic,
}


def conteudo_confere_com_tipo(conteudo: bytes, content_type: str) -> bool:
    """
    True se os bytes batem com a assinatura esperada para o content_type.
    Tipo sem assinatura conhecida devolve False — quem valida decide se aceita;
    a política aqui é negar o que não se consegue provar.
    """
    checagem = ASSINATURAS_ARQUIVO.get(content_type)
    return bool(checagem and checagem(conteudo))


def detectar_tipo_por_conteudo(conteudo: bytes) -> str | None:
    """Content-Type real dos bytes, ou None se não for um formato conhecido."""
    for mime, checagem in ASSINATURAS_ARQUIVO.items():
        # heic/heif compartilham assinatura; o primeiro match (heic) serve.
        if checagem(conteudo):
            return mime
    return None


_NOME_INVALIDO = re.compile(r'[\x00-\x1f\x7f<>:"/\\|?*]')


def sanitizar_nome_arquivo(nome: str | None, padrao: str = "documento") -> str:
    """
    Nome de arquivo vindo do cliente é entrada de usuário: vai para o banco e é
    renderizado no gestor web. Tira diretório, caracteres de controle/HTML e
    limita o tamanho. Não define onde o arquivo é gravado (isso é UUID no
    generate_filename) — serve só para exibição.
    """
    nome = (nome or "").strip()
    nome = nome.replace("\\", "/").split("/")[-1]  # descarta qualquer caminho
    nome = unicodedata.normalize("NFC", nome)
    nome = _NOME_INVALIDO.sub("", nome).strip(" .")
    if not nome:
        return padrao
    base, ext = os.path.splitext(nome)
    return f"{base[:120]}{ext[:10]}"

# Thumbnail das fotos de veículo: WebP com no máximo THUMB_MAX_WIDTH de largura.
# 640px cobre os cards das listas (Estoque, feed, vitrine) inclusive em telas 2x;
# o original continua sendo servido nas telas de detalhe.
THUMB_MAX_WIDTH = 640
THUMB_WEBP_QUALITY = 75


def gerar_thumbnail(conteudo: bytes) -> bytes | None:
    """
    Gera um thumbnail WebP a partir dos bytes de uma imagem.
    Retorna None se o conteúdo não for uma imagem decodificável — o chamador
    segue sem thumb (o front faz fallback para a URL original).
    CPU-bound: chamar via asyncio.to_thread para não travar o event loop.
    """
    try:
        from PIL import Image, ImageOps

        img = Image.open(io.BytesIO(conteudo))
        img = ImageOps.exif_transpose(img) or img
        if img.mode == "P":
            img = img.convert("RGBA")
        elif img.mode not in ("RGB", "RGBA"):
            img = img.convert("RGB")
        if img.width > THUMB_MAX_WIDTH:
            altura = max(1, round(img.height * THUMB_MAX_WIDTH / img.width))
            img = img.resize((THUMB_MAX_WIDTH, altura), Image.LANCZOS)
        buf = io.BytesIO()
        img.save(buf, format="WEBP", quality=THUMB_WEBP_QUALITY)
        return buf.getvalue()
    except Exception:
        return None


class StorageProvider:
    def __init__(self):
        # Verificar se as configurações do S3 foram fornecidas
        self.use_s3 = all([
            settings.s3_access_key,
            settings.s3_secret_key,
            settings.s3_bucket_name
        ])

        if self.use_s3:
            print("[Storage] Usando provedor S3/MinIO para armazenamento de mídias.")
            s3_args = {
                "aws_access_key_id": settings.s3_access_key,
                "aws_secret_access_key": settings.s3_secret_key,
                "region_name": settings.s3_region
            }
            if settings.s3_endpoint_url:
                s3_args["endpoint_url"] = settings.s3_endpoint_url

            self.s3_client = boto3.client("s3", **s3_args)
            self.bucket_name = settings.s3_bucket_name
        else:
            print("[Storage] Usando provedor LOCAL de desenvolvimento.")
            self.local_dir = os.path.join(os.path.dirname(__file__), "static", "uploads")
            os.makedirs(self.local_dir, exist_ok=True)

    # Extensão é derivada do content_type já validado pelo router (whitelist),
    # nunca do nome de arquivo enviado pelo cliente — evita salvar .php/.exe
    # disfarçado de imagem com Content-Type forjado.
    CONTENT_TYPE_EXT = {
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg",
        "image/png": ".png",
        "image/webp": ".webp",
        "video/mp4": ".mp4",
        "video/mpeg": ".mpeg",
        "video/quicktime": ".mov",
        "video/webm": ".webm",
        "application/pdf": ".pdf",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/ogg": ".ogg",
    }

    def generate_filename(self, original_filename: str, content_type: str = "") -> str:
        ext = self.CONTENT_TYPE_EXT.get(content_type)
        if ext is None:
            ext = os.path.splitext(original_filename)[1].lower()
        return f"{uuid.uuid4().hex}{ext}"

    @staticmethod
    def _build_key(prefixo: str, unique_filename: str) -> str:
        # Prefixo organiza os objetos em "pastas" virtuais no R2 (ex.:
        # "lojas/<loja_id>/veiculos"). Opcional: sem prefixo, cai na raiz —
        # mantém compatível com as URLs já existentes.
        prefixo = (prefixo or "").strip("/")
        return f"{prefixo}/{unique_filename}" if prefixo else unique_filename

    async def upload_file(
        self, file_content: bytes, filename: str, content_type: str, prefixo: str = "",
        forcar_download: bool = False,
    ) -> str:
        """
        Faz upload do arquivo e retorna a URL pública de acesso.

        prefixo: "pasta" virtual no storage (ex.: "lojas/<id>/veiculos"). Serve
        para organizar/isolar os arquivos por loja e tipo — navegação no painel
        e exclusão em lote (LGPD). Vazio = raiz do bucket.

        forcar_download: grava Content-Disposition: attachment, para o navegador
        baixar em vez de renderizar. Usar em arquivo enviado por usuário que não
        precisa abrir inline (documentos) — se algum dia um tipo perigoso passar
        pela validação, ele desce como arquivo em vez de executar na origem.
        """
        unique_filename = self._build_key(prefixo, self.generate_filename(filename, content_type))
        return await self._put(
            unique_filename, file_content, content_type, forcar_download=forcar_download
        )

    async def _put(
        self, key: str, content: bytes, content_type: str, forcar_download: bool = False
    ) -> str:
        """Grava bytes numa Key do storage ativo e retorna a URL pública."""
        if self.use_s3:
            try:
                extra = {"ContentDisposition": "attachment"} if forcar_download else {}
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=content,
                    ContentType=content_type,
                    **extra,
                )
                if settings.s3_public_url:
                    return f"{settings.s3_public_url.rstrip('/')}/{key}"
                else:
                    endpoint = settings.s3_endpoint_url or f"https://s3.{settings.s3_region}.amazonaws.com"
                    return f"{endpoint.rstrip('/')}/{self.bucket_name}/{key}"
            except ClientError as e:
                print(f"[Storage] Erro ao fazer upload para S3: {e}")
                raise e
        else:
            # Salvar localmente (criando as "pastas" do prefixo, ex.: lojas/<id>/veiculos)
            # forcar_download não se aplica aqui: o StaticFiles do /static serve
            # inline e não guarda metadado por arquivo. Só afeta dev — em produção
            # o storage é S3/R2, onde o header é gravado no objeto.
            file_path = os.path.join(self.local_dir, *key.split("/"))
            os.makedirs(os.path.dirname(file_path), exist_ok=True)
            with open(file_path, "wb") as f:
                f.write(content)
            return f"/static/uploads/{key}"

    async def upload_imagem_com_thumb(
        self, file_content: bytes, filename: str, content_type: str, prefixo: str = ""
    ) -> tuple[str, str | None]:
        """
        Sobe a imagem original e um thumbnail WebP (subpasta thumbs/, mesmo nome).
        Retorna (url, thumb_url). thumb_url é None se a geração falhar — o
        upload do original nunca é bloqueado pelo thumb.
        """
        unique = self.generate_filename(filename, content_type)
        url = await self._put(self._build_key(prefixo, unique), file_content, content_type)

        thumb_url = None
        thumb_bytes = await asyncio.to_thread(gerar_thumbnail, file_content)
        if thumb_bytes:
            base = os.path.splitext(unique)[0]
            prefixo_thumbs = f"{prefixo.strip('/')}/thumbs" if prefixo.strip("/") else "thumbs"
            try:
                thumb_url = await self._put(
                    self._build_key(prefixo_thumbs, f"{base}.webp"), thumb_bytes, "image/webp"
                )
            except Exception as e:
                print(f"[Storage] Thumb falhou (original ok): {e}")
        return url, thumb_url

    def _key_from_url(self, file_url: str) -> str:
        # A Key pode ter prefixo (ex.: "lojas/<id>/veiculos/<uuid>.jpg"), então
        # não basta pegar o último segmento: derivamos a Key relativa à base
        # pública do bucket. Fallback para o último segmento (URLs antigas, sem
        # prefixo, ou storage local).
        base = (settings.s3_public_url or "").rstrip("/")
        if base and file_url.startswith(base):
            return file_url[len(base):].lstrip("/")
        return file_url.split("/")[-1]

    async def delete_file(self, file_url: str):
        """
        Remove um arquivo do storage baseado em sua URL pública.
        """
        if self.use_s3:
            try:
                self.s3_client.delete_object(Bucket=self.bucket_name, Key=self._key_from_url(file_url))
            except ClientError as e:
                print(f"[Storage] Erro ao deletar do S3: {e}")
        else:
            filename = file_url.split("/")[-1]
            file_path = os.path.join(self.local_dir, filename)
            if os.path.exists(file_path):
                os.remove(file_path)

    async def upload_json(self, json_content: bytes, filename: str) -> str:
        """
        Faz upload de um arquivo JSON (backup de conversa) e retorna a URL ou caminho.
        """
        if self.use_s3:
            try:
                key = f"chats/{filename}"
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=key,
                    Body=json_content,
                    ContentType="application/json"
                )
                if settings.s3_public_url:
                    return f"{settings.s3_public_url.rstrip('/')}/{key}"
                else:
                    endpoint = settings.s3_endpoint_url or f"https://s3.{settings.s3_region}.amazonaws.com"
                    return f"{endpoint.rstrip('/')}/{self.bucket_name}/{key}"
            except ClientError as e:
                print(f"[Storage] Erro ao fazer upload do JSON para S3: {e}")
                raise e
        else:
            # Salvar localmente em static/uploads/chats/
            chats_dir = os.path.join(self.local_dir, "chats")
            os.makedirs(chats_dir, exist_ok=True)
            file_path = os.path.join(chats_dir, filename)
            with open(file_path, "wb") as f:
                f.write(json_content)
            return f"/static/uploads/chats/{filename}"

    async def download_json(self, file_url: str) -> bytes:
        """
        Baixa um arquivo JSON do R2/S3 ou lê do filesystem local.
        """
        if self.use_s3:
            try:
                parts = file_url.split("/")
                try:
                    idx = parts.index("chats")
                    key = "/".join(parts[idx:])
                except ValueError:
                    key = parts[-1]

                response = self.s3_client.get_object(Bucket=self.bucket_name, Key=key)
                return response["Body"].read()
            except ClientError as e:
                print(f"[Storage] Erro ao baixar JSON do S3: {e}")
                raise e
        else:
            # Ler localmente
            filename = file_url.split("/")[-1]
            file_path = os.path.join(self.local_dir, "chats", filename)
            if os.path.exists(file_path):
                with open(file_path, "rb") as f:
                    return f.read()
            raise FileNotFoundError(f"Arquivo local não encontrado: {file_path}")


storage_provider = StorageProvider()
