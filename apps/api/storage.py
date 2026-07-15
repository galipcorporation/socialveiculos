import os
import uuid
import shutil
from typing import Optional
import boto3
from botocore.exceptions import ClientError

from config import settings

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
        self, file_content: bytes, filename: str, content_type: str, prefixo: str = ""
    ) -> str:
        """
        Faz upload do arquivo e retorna a URL pública de acesso.

        prefixo: "pasta" virtual no storage (ex.: "lojas/<id>/veiculos"). Serve
        para organizar/isolar os arquivos por loja e tipo — navegação no painel
        e exclusão em lote (LGPD). Vazio = raiz do bucket.
        """
        unique_filename = self._build_key(prefixo, self.generate_filename(filename, content_type))

        if self.use_s3:
            try:
                # Fazer upload para o S3
                self.s3_client.put_object(
                    Bucket=self.bucket_name,
                    Key=unique_filename,
                    Body=file_content,
                    ContentType=content_type
                )
                if settings.s3_public_url:
                    return f"{settings.s3_public_url.rstrip('/')}/{unique_filename}"
                else:
                    endpoint = settings.s3_endpoint_url or f"https://s3.{settings.s3_region}.amazonaws.com"
                    return f"{endpoint.rstrip('/')}/{self.bucket_name}/{unique_filename}"
            except ClientError as e:
                print(f"[Storage] Erro ao fazer upload para S3: {e}")
                raise e
        else:
            # Salvar localmente
            file_path = os.path.join(self.local_dir, unique_filename)
            with open(file_path, "wb") as f:
                f.write(file_content)
            
            # Retornar URL local
            return f"/static/uploads/{unique_filename}"

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
